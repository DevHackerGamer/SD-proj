import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilePreviewModal from '../components/filesystem/components/FilePreviewModal';
import { fileSystemService } from '../components/filesystem/FileSystemService';
import type { BlobItem } from '../components/filesystem/types';

// Mock fileSystemService methods
jest.mock('../components/filesystem/FileSystemService', () => ({
  fileSystemService: {
    getDownloadUrl: jest.fn(),
    getMetadataJson: jest.fn()
  }
}));

const mockOnClose = jest.fn();

const mockImageItem: BlobItem = {
    id:'1',
  name: 'image.png',
  path: 'images/image.png',
  isDirectory: false,
  contentType: 'image/png'
};

const mockPdfItem: BlobItem = {
    id:'2',
  name: 'doc.pdf',
  path: 'docs/doc.pdf',
  isDirectory: false,
  contentType: 'application/pdf'
};

const mockTextItem: BlobItem = {
    id:'3',
  name: 'notes.txt',
  path: 'text/notes.txt',
  isDirectory: false,
  contentType: 'text/plain'
};

const mockMetadataItem: BlobItem = {
    id:'4',
  name: 'metadata.json',
  path: 'meta/metadata.json',
  isDirectory: false,
  contentType: 'application/json'
};

describe('FilePreviewModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders image preview correctly', async () => {
    (fileSystemService.getDownloadUrl as jest.Mock).mockResolvedValue('https://mocked-image-url.com/image.png');

    render(<FilePreviewModal item={mockImageItem} onClose={mockOnClose} />);

    expect(screen.getByText(/Loading preview/i)).toBeInTheDocument();

    await waitFor(() => {
      const image = screen.getByRole('img');
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute('src', expect.stringContaining('mocked-image-url.com'));
    });
  });

  test('renders PDF preview correctly', async () => {
    (fileSystemService.getDownloadUrl as jest.Mock).mockResolvedValue('https://mocked-url.com/doc.pdf');

    render(<FilePreviewModal item={mockPdfItem} onClose={mockOnClose} />);

    await waitFor(() => {
      const iframe = screen.getByTitle('doc.pdf');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', expect.stringContaining('mocked-url.com'));
    });
  });

  test('renders metadata.json content correctly', async () => {
    const mockMetadata = { title: 'Constitution', year: 1996 };
    (fileSystemService.getDownloadUrl as jest.Mock).mockResolvedValue('https://mocked-url.com/meta.json');
    (fileSystemService.getMetadataJson as jest.Mock).mockResolvedValue(mockMetadata);

    render(<FilePreviewModal item={mockMetadataItem} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText(/Constitution/i)).toBeInTheDocument();
      expect(screen.getByText(/1996/i)).toBeInTheDocument();
    });
  });

  test('renders download link fallback for text file', async () => {
    (fileSystemService.getDownloadUrl as jest.Mock).mockResolvedValue('https://mocked-url.com/notes.txt');

    render(<FilePreviewModal item={mockTextItem} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText(/Preview not available/i)).toBeInTheDocument();
      const downloadLink = screen.getByRole('link');
      expect(downloadLink).toHaveAttribute('href', expect.stringContaining('notes.txt'));
    });
  });

  test('renders error message on failure', async () => {
    (fileSystemService.getDownloadUrl as jest.Mock).mockRejectedValue(new Error('SAS error'));

    render(<FilePreviewModal item={mockTextItem} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load preview/i)).toBeInTheDocument();
    });
  });

  test('calls onClose when overlay is clicked', async () => {
    (fileSystemService.getDownloadUrl as jest.Mock).mockResolvedValue('https://mocked-url.com/notes.txt');

    render(<FilePreviewModal item={mockTextItem} onClose={mockOnClose} />);

    const overlay = screen.getByRole('dialog').parentElement! || screen.getByTestId("modal-content");
    fireEvent.click(overlay);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('does not call onClose when modal content is clicked', async () => {
    (fileSystemService.getDownloadUrl as jest.Mock).mockResolvedValue('https://mocked-url.com/notes.txt');

    render(<FilePreviewModal item={mockTextItem} onClose={mockOnClose} />);

    const content = screen.getByTestId("preview-area");
    fireEvent.click(content);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test('renders nothing when item is null', () => {
    const { container } = render(<FilePreviewModal item={null} onClose={mockOnClose} />);
    expect(container.firstChild).toBeNull();
  });
});
