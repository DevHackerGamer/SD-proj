import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BasicFileSystem from './BasicFileSystem';

describe('BasicFileSystem Component', () => {
  it('renders upload section and toolbar', () => {
    render(<BasicFileSystem />);

    // Check title
    expect(screen.getByText('Basic Azure File System')).toBeInTheDocument();

    // Check Upload input
    expect(screen.getByLabelText('Upload File:')).toBeInTheDocument();

    // Check Toolbar buttons
    expect(screen.getByTitle('New Folder')).toBeInTheDocument();
    expect(screen.getByTitle('Go Up One Level')).toBeInTheDocument();

    // Check "Root" display
    expect(screen.getByText('Root')).toBeInTheDocument();
  });

  it('handles file upload interaction', async () => {
    render(<BasicFileSystem />);

    const fileInput = screen.getByLabelText('Upload File:') as HTMLInputElement;
    
    const mockFile = new File(['file content'], 'example.txt', { type: 'text/plain' });

    // Fire a file upload event
    fireEvent.change(fileInput, {
      target: { files: [mockFile] },
    });

    // You can assert what changes after upload if any — for now, let's just check input got updated
    expect(fileInput.files?.[0]).toEqual(mockFile);

    // If uploading shows some notification, you should check for it here
    // Example (optional if your UI shows something after upload)
    // expect(screen.getByText(/uploaded successfully/i)).toBeInTheDocument();
  });
});
