import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FileListDisplay from '../components/filesystem/components/FileListDisplay';
import type { BlobItem,SortKey,SortDirection } from '../components/filesystem/types'
import '@testing-library/jest-dom';

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const mockItems: BlobItem[] = [
  {
    id: 'file-1',
    name: 'file1.txt',
    path: 'file1.txt',
    isDirectory: false,
    size: 1024,
    lastModified: new Date(),
    contentType: 'text/plain',
  },
  {
    id: 'folder-1',
    name: 'folder1',
    path: 'folder1',
    isDirectory: true,
    size: 0,
    lastModified: new Date(),
  },
];

const baseProps = {
  items: mockItems,
  isLoading: false,
  selectedPaths: new Set<string>(),
  itemsToMovePathsSet: new Set<string>(),
  renamingPath: null,
  tempNewName: '',
  highlightedPath: null,
  sortKey: 'name' as SortKey,
  sortDirection: 'asc' as SortDirection,
  isFiltering: false,
  draggedItemPath: null,
  dragOverPath: null,
  onDelete: jest.fn(),
  onItemDoubleClick: jest.fn(),
  onItemSelect: jest.fn(),
  onTempNewNameChange: jest.fn(),
  onRenameConfirm: jest.fn(),
  onRenameCancel: jest.fn(),
  onContextMenu: jest.fn(),
  onDragStart: jest.fn(),
  onDragEnd: jest.fn(),
  onDragOver: jest.fn(),
  onDragEnter: jest.fn(),
  onDragLeave: jest.fn(),
  onDrop: jest.fn(),
  onSelectAll: jest.fn(),
  onSort: jest.fn(),
  onDownload: jest.fn(),
  onEditMetadata: jest.fn(),
};

describe('FileListDisplay', () => {
  it('renders file and folder items', () => {
    render(<FileListDisplay {...baseProps} />);
    expect(screen.getByText('file1.txt')).toBeInTheDocument();
    expect(screen.getByText('folder1')).toBeInTheDocument();
  });

    it('calls onRenameCancel when renaming is cancelled with Escape key', () => {
    render(
      <FileListDisplay
        {...baseProps}
        renamingPath="file1.txt"
        tempNewName="newname.txt"
      />
    );
    const input = screen.getByDisplayValue('newname.txt');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(baseProps.onRenameCancel).toHaveBeenCalled();
  });

  // Trigger context menu on right-click
  it('calls onContextMenu on right-click', () => {
    render(<FileListDisplay {...baseProps} />);
    const row = screen.getByText('file1.txt').closest('div');
    if (row) {
      fireEvent.contextMenu(row);
      expect(baseProps.onContextMenu).toHaveBeenCalled();
    }
  });

  // Drag events on a file (not just folders)
  it('handles dragStart and dragEnd events on file items', () => {
    render(<FileListDisplay {...baseProps} />);
    const fileRow = screen.getByText('file1.txt').closest('div');
    if (fileRow) {
      fireEvent.dragStart(fileRow);
      fireEvent.dragEnd(fileRow);
      expect(baseProps.onDragStart).toHaveBeenCalled();
      expect(baseProps.onDragEnd).toHaveBeenCalled();
    }
  });

  // Trigger sorting by clicking on a sortable header (assuming 'Name' header is clickable)
  it('calls onSort when clicking sortable header', () => {
    render(<FileListDisplay {...baseProps} />);
    const nameHeader = screen.getByText(/name/i);
    fireEvent.click(nameHeader);
    expect(baseProps.onSort).toHaveBeenCalled();
  });

  // Select/Deselect with ctrlKey (or metaKey) to test multi-select toggle
  it('calls onItemSelect with false when clicked with ctrlKey', () => {
    const onItemSelect = jest.fn();
    render(<FileListDisplay {...baseProps} onItemSelect={onItemSelect} />);
    const row = screen.getByTestId('file-row-file1.txt');
    fireEvent.click(row, { ctrlKey: true });
    expect(onItemSelect).toHaveBeenCalledWith('file1.txt', true, false);
  });

  // Check that highlighted row has the correct class
  it('renders highlighted row correctly', () => {
    render(<FileListDisplay {...baseProps} highlightedPath="file1.txt" />);
    const row = screen.getByTestId('file-row-file1.txt');
    expect(row).toHaveClass('highlighted');
  });

  it('shows loading indicator', () => {
    render(<FileListDisplay {...baseProps} isLoading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows empty state when no items and not filtering', () => {
    render(<FileListDisplay {...baseProps} items={[]} />);
    expect(screen.getByText('This folder is empty')).toBeInTheDocument();
  });

  it('shows "No matching files" when filtering and no items', () => {
    render(<FileListDisplay {...baseProps} items={[]} isFiltering />);
    expect(screen.getByText('No matching files')).toBeInTheDocument();
  });
  
it('calls onItemSelect when row is clicked', () => {
  const onItemSelect = jest.fn();
  render(
    <FileListDisplay
      {...baseProps}
      onItemSelect={onItemSelect}
    />
  );
  const row = screen.getByTestId('file-row-file1.txt');
  fireEvent.click(row);
  expect(onItemSelect).toHaveBeenCalledWith('file1.txt', true, false);
});

  it('calls onItemDoubleClick when item is double-clicked', () => {
    render(<FileListDisplay {...baseProps} />);
    const row = screen.getByText('file1.txt').closest('div');
    if (row) fireEvent.doubleClick(row);
    expect(baseProps.onItemDoubleClick).toHaveBeenCalledWith(mockItems[0]);
  });

  it('calls onDownload and onDelete from action buttons', () => {
    render(<FileListDisplay {...baseProps} />);
    const downloadBtn = screen.getAllByTitle('Download')[0];
    const deleteBtn = screen.getAllByTitle('Delete')[0];
    fireEvent.click(downloadBtn);
    fireEvent.click(deleteBtn);
    expect(baseProps.onDownload).toHaveBeenCalledWith(mockItems[0]);
    expect(baseProps.onDelete).toHaveBeenCalledWith('file1.txt');
  });

  it('enters rename mode and handles input', () => {
    render(
      <FileListDisplay
        {...baseProps}
        renamingPath="file1.txt"
        tempNewName="newname.txt"
      />
    );
    const input = screen.getByDisplayValue('newname.txt');
    fireEvent.change(input, { target: { value: 'renamed.txt' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(baseProps.onTempNewNameChange).toHaveBeenCalledWith('renamed.txt');
    expect(baseProps.onRenameConfirm).toHaveBeenCalledWith('file1.txt', 'newname.txt');
  });

  it('calls onSelectAll when select-all checkbox is clicked', () => {
    render(<FileListDisplay {...baseProps} />);
    const checkbox = screen.getByLabelText('Select all items');
    fireEvent.click(checkbox);
    expect(baseProps.onSelectAll).toHaveBeenCalledWith(true);
  });

  it('applies drag-and-drop handlers on folder items', () => {
    render(<FileListDisplay {...baseProps} />);
    const folderRow = screen.getByText('folder1').closest('div');
    if (folderRow) {
      fireEvent.dragOver(folderRow);
      fireEvent.dragEnter(folderRow);
      fireEvent.dragLeave(folderRow);
      fireEvent.drop(folderRow);
      expect(baseProps.onDragOver).toHaveBeenCalled();
      expect(baseProps.onDragEnter).toHaveBeenCalled();
      expect(baseProps.onDragLeave).toHaveBeenCalled();
      expect(baseProps.onDrop).toHaveBeenCalled();
    }
  });
});