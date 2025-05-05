// File: client/src/components/__tests__/Toolbar.test.tsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react'; // ✅ must come from @testing-library/react
import React from 'react'; // ✅ react must still be imported
import Toolbar from '../Toolbar'; // ✅ correct relative path to your Toolbar component

// 1. Mock the MetadataForm
vi.mock('../MetadataForm', () => ({
  __esModule: true,
  default: ({ onCancel }: any) => (
    <div data-testid="metadata-form">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

// 2. Mock hooks
const createDirMock = vi.fn();
vi.mock('../context/FileSystemContext', () => ({
  useFileSystem: () => ({
    createDirectory: createDirMock,
  }),
}));

const prepareFilesMock = vi.fn();
const uploadWithMetadataMock = vi.fn();
const cancelUploadMock = vi.fn();
let mockShowMetadataForm = false;

vi.mock('../hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    isUploading: false,
    showMetadataForm: mockShowMetadataForm,
    filesToUpload: [],
    prepareFilesForUpload: prepareFilesMock,
    uploadFilesWithMetadata: uploadWithMetadataMock,
    cancelUpload: cancelUploadMock,
  }),
}));

describe('<Toolbar />', () => {
  const onCreateFolder = vi.fn();
  const onUpload = vi.fn();
  const onSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockShowMetadataForm = false;
  });

  it('calls onCreateFolder when Create Folder button is clicked', () => {
    render(
      <Toolbar
        onCreateFolder={onCreateFolder}
        onUpload={onUpload}
        showUploader={false}
        searchTerm=""
        onSearch={onSearch}
      />
    );

    fireEvent.click(screen.getByText(/Create Folder/i));
    expect(onCreateFolder).toHaveBeenCalled();
  });

  it('prepares files for upload when files are selected', () => {
    render(
      <Toolbar
        onCreateFolder={onCreateFolder}
        onUpload={onUpload}
        showUploader={false}
        searchTerm=""
        onSearch={onSearch}
      />
    );

    const input = screen.getByTestId('file-input') as HTMLInputElement;
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(prepareFilesMock).toHaveBeenCalledWith(expect.any(FileList));
  });

  it('calls onSearch with the new term when the search input changes', () => {
    render(
      <Toolbar
        onCreateFolder={onCreateFolder}
        onUpload={onUpload}
        showUploader={false}
        searchTerm="foo"
        onSearch={onSearch}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search in current directory/i);
    fireEvent.change(searchInput, { target: { value: 'bar' } });

    expect(onSearch).toHaveBeenCalledWith('bar');
  });

  it('renders MetadataForm when showMetadataForm is true', () => {
    mockShowMetadataForm = true;

    render(
      <Toolbar
        onCreateFolder={onCreateFolder}
        onUpload={onUpload}
        showUploader={false}
        searchTerm=""
        onSearch={onSearch}
      />
    );

    expect(screen.getByTestId('metadata-form')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(cancelUploadMock).toHaveBeenCalled();
  });
});
