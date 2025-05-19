import React from 'react';
import {
  render,
  screen,
  fireEvent,
  createEvent,
} from '@testing-library/react';
import FileListItem from '../components/filesystem/components/FileListItem';
import type { BlobItem } from '../components/filesystem/types';
import styles from '../BasicFileSystem.module.css'; // Import this!

// Mock getIconForFile util to avoid complexity in tests
jest.mock('../components/filesystem/utils/getIconForFile', () => ({
  getIconForFile: () => <span data-testid="file-icon">icon</span>,
}));

const defaultItem: BlobItem = {
  id: 'file-1',
  path: '/folder/file.txt',
  name: 'file.txt',
  size: 2048,
  lastModified: new Date('2023-01-01T12:00:00Z'),
  isDirectory: false,
};

const defaultProps = {
  item: defaultItem,
  isLoading: false,
  onDelete: jest.fn(),
  onItemDoubleClick: jest.fn(),
  isSelected: false,
  onSelect: jest.fn(),
  isDragged: false,
  isDragOver: false,
  onDragStart: jest.fn(),
  onDragEnd: jest.fn(),
  onDragOver: jest.fn(),
  onDragEnter: jest.fn(),
  onDragLeave: jest.fn(),
  onDrop: jest.fn(),
  isMarkedForMove: false,
  isRenaming: false,
  tempNewName: '',
  onTempNewNameChange: jest.fn(),
  onRenameConfirm: jest.fn(),
  onRenameCancel: jest.fn(),
  onContextMenu: jest.fn(),
  onDownload: jest.fn(),
};

describe('FileListItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders file name and icon', () => {
    render(<FileListItem {...defaultProps} />);
    expect(screen.getByText(defaultItem.name)).toBeInTheDocument();
    expect(screen.getByTestId('file-icon')).toBeInTheDocument();
  });

  it('renders file size formatted correctly', () => {
    render(<FileListItem {...defaultProps} />);
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('renders last modified date correctly', () => {
    render(<FileListItem {...defaultProps} />);
    expect(screen.getByText(defaultItem.lastModified!.toLocaleString())).toBeInTheDocument();
  });

  it('checkbox calls onSelect with correct values', () => {
    render(<FileListItem {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(defaultProps.onSelect).toHaveBeenCalledWith(defaultItem.path, true);
  });

  it('checkbox is disabled during renaming or loading', () => {
    const { rerender } = render(<FileListItem {...defaultProps} isRenaming />);
    expect(screen.getByRole('checkbox')).toBeDisabled();

    rerender(<FileListItem {...defaultProps} isLoading />);
    expect(screen.getByRole('checkbox')).toBeDisabled();
  });

  it('double click calls onItemDoubleClick if not renaming or loading', () => {
    render(<FileListItem {...defaultProps} />);
    fireEvent.doubleClick(screen.getByText(defaultItem.name));
    expect(defaultProps.onItemDoubleClick).toHaveBeenCalledWith(defaultItem);
  });

  it('double click does not call onItemDoubleClick during renaming or loading', () => {
    const { rerender } = render(<FileListItem {...defaultProps} isRenaming />);
    fireEvent.doubleClick(screen.getByTestId('file-item-file.txt'));
    expect(defaultProps.onItemDoubleClick).not.toHaveBeenCalled();

    rerender(<FileListItem {...defaultProps} isLoading />);
    fireEvent.doubleClick(screen.getByText(defaultItem.name));
    expect(defaultProps.onItemDoubleClick).not.toHaveBeenCalled();
  });

  it('shows rename input when isRenaming is true and focuses/selects it', () => {
    render(<FileListItem {...defaultProps} isRenaming tempNewName="newName.txt" />);
    const input = screen.getByDisplayValue('newName.txt');
    expect(input).toBeInTheDocument();
  });

  it('rename input changes call onTempNewNameChange', () => {
    render(<FileListItem {...defaultProps} isRenaming tempNewName="newName.txt" />);
    const input = screen.getByDisplayValue('newName.txt');
    fireEvent.change(input, { target: { value: 'changed.txt' } });
    expect(defaultProps.onTempNewNameChange).toHaveBeenCalledWith('changed.txt');
  });

  it('rename input Enter key calls onRenameConfirm', () => {
    render(<FileListItem {...defaultProps} isRenaming tempNewName="newName.txt" />);
    const input = screen.getByDisplayValue('newName.txt');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(defaultProps.onRenameConfirm).toHaveBeenCalledWith(defaultItem.path, 'newName.txt');
  });

  it('rename input Escape key calls onRenameCancel', () => {
    render(<FileListItem {...defaultProps} isRenaming tempNewName="newName.txt" />);
    const input = screen.getByDisplayValue('newName.txt');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(defaultProps.onRenameCancel).toHaveBeenCalled();
  });

  it('rename input blur calls onRenameCancel', () => {
    render(<FileListItem {...defaultProps} isRenaming tempNewName="newName.txt" />);
    const input = screen.getByDisplayValue('newName.txt');
    fireEvent.blur(input);
    expect(defaultProps.onRenameCancel).toHaveBeenCalled();
  });

it('context menu calls onContextMenu unless renaming or loading', () => {
  const onContextMenuMock = jest.fn();
  const props = { ...defaultProps, onContextMenu: onContextMenuMock };

  const { rerender } = render(<FileListItem {...props} />);
  
  
  fireEvent.contextMenu(screen.getByTestId(`file-item-${defaultItem.name}`));
  expect(onContextMenuMock).toHaveBeenCalledTimes(1);

  onContextMenuMock.mockClear();

  rerender(<FileListItem {...props} isRenaming />);
  fireEvent.contextMenu(screen.getByTestId(`file-item-${defaultItem.name}`));
  expect(onContextMenuMock).not.toHaveBeenCalled();

  rerender(<FileListItem {...props} isLoading />);
  fireEvent.contextMenu(screen.getByTestId(`file-item-${defaultItem.name}`));
  expect(onContextMenuMock).not.toHaveBeenCalled();
});


  it('download button calls onDownload and stops propagation', () => {
    render(<FileListItem {...defaultProps} />);
    const button = screen.getByTitle(`Download ${defaultItem.name}`);
    const event = createEvent.click(button);
    event.stopPropagation = jest.fn();
    fireEvent(button, event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(defaultProps.onDownload).toHaveBeenCalledWith(defaultItem);
  });

  it('delete button calls onDelete and stops propagation', () => {
    render(<FileListItem {...defaultProps} />);
    const button = screen.getByTitle(`Delete ${defaultItem.name}`);
    const event = createEvent.click(button);
    event.stopPropagation = jest.fn();
    fireEvent(button, event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(defaultProps.onDelete).toHaveBeenCalledWith(defaultItem.path);
  });

  describe('drag and drop handlers', () => {
    const directoryItem: BlobItem = {
      ...defaultItem,
      isDirectory: true,
      path: '/folder',
      name: 'folder',
    };

test('dragStart triggers onDragStart', () => {
  const onDragStartMock = jest.fn();
  render(
    <div
      data-testid="draggable"
      draggable
      onDragStart={(e) => onDragStartMock(e)}
    >
      Drag me
    </div>
  );

  const el = screen.getByTestId('draggable');

  fireEvent.dragStart(el, {
    dataTransfer: {
      setData: jest.fn(),
      getData: jest.fn(),
    },
  });

  expect(onDragStartMock).toHaveBeenCalled();
});

    it('dragStart prevented if isLoading is true', () => {
      const props = { ...defaultProps, item: directoryItem, isLoading: true };
      render(<FileListItem {...props} />);
      fireEvent.dragStart(screen.getByRole('listitem'));
      expect(props.onDragStart).not.toHaveBeenCalled();
    });

    it('drag over, enter, leave, drop call props only for directories', () => {
      const props = { ...defaultProps, item: directoryItem };
      render(<FileListItem {...props} />);
      const li = screen.getByRole('listitem');

      fireEvent.dragOver(li);
      expect(props.onDragOver).toHaveBeenCalledWith(expect.any(Object), directoryItem.path);

      fireEvent.dragEnter(li);
      expect(props.onDragEnter).toHaveBeenCalledWith(expect.any(Object), directoryItem.path);

      fireEvent.dragLeave(li);
      expect(props.onDragLeave).toHaveBeenCalledWith(expect.any(Object), directoryItem.path);

      fireEvent.drop(li);
      expect(props.onDrop).toHaveBeenCalledWith(expect.any(Object), directoryItem.path);
    });

    it('drag handlers do not call props for non-directory items', () => {
      render(<FileListItem {...defaultProps} />);
      const li = screen.getByRole('listitem');

      fireEvent.dragOver(li);
      fireEvent.dragEnter(li);
      fireEvent.dragLeave(li);
      fireEvent.drop(li);

      expect(defaultProps.onDragOver).not.toHaveBeenCalled();
      expect(defaultProps.onDragEnter).not.toHaveBeenCalled();
      expect(defaultProps.onDragLeave).not.toHaveBeenCalled();
      expect(defaultProps.onDrop).not.toHaveBeenCalled();
    });

    it('li element draggable prop respects isLoading, isMarkedForMove and isRenaming', () => {
      const { rerender } = render(<FileListItem {...defaultProps} />);
      expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'true');

      rerender(<FileListItem {...defaultProps} isLoading />);
      expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'false');

      rerender(<FileListItem {...defaultProps} isMarkedForMove />);
      expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'false');

      rerender(<FileListItem {...defaultProps} isRenaming />);
      expect(screen.getByRole('listitem')).toHaveAttribute('draggable', 'false');
    });
  });

  it('applies correct CSS classes based on props', () => {
    const { container, rerender } = render(<FileListItem {...defaultProps} />);
    const li = container.firstChild!;
    expect(li).toHaveClass(styles.fileItem);
    expect(li).not.toHaveClass('selected');
    expect(li).not.toHaveClass('dragging');
    expect(li).not.toHaveClass('dragOver');
    expect(li).not.toHaveClass('markedForMove');

    rerender(<FileListItem {...defaultProps} isSelected isDragged isDragOver isMarkedForMove />);
    const updatedLi = container.firstChild!;
    expect(updatedLi).toHaveClass('selected');
    expect(updatedLi).toHaveClass('dragging');
    expect(updatedLi).toHaveClass('dragOver');
    expect(updatedLi).toHaveClass('markedForMove');
  });
});