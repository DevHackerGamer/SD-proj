import React from 'react';
import { render, screen } from '@testing-library/react';
import { FolderIcon, FileIcon } from '../components/filesystem/components/Icons'; // Replace with actual path

describe('Icon components with data-testid', () => {
  it('renders FolderIcon correctly', () => {
    render(<FolderIcon />);
    const icon = screen.getByTestId('folder-icon');
    expect(icon).toBeInTheDocument();
  });

  it('renders PdfIcon when contentType is application/pdf', () => {
    render(<FileIcon contentType="application/pdf" />);
    const icon = screen.getByTestId('pdf-icon');
    expect(icon).toBeInTheDocument();
  });

  it('renders GenericFileIcon for unknown content type', () => {
    render(<FileIcon contentType="application/octet-stream" />);
    const icon = screen.getByTestId('generic-file-icon');
    expect(icon).toBeInTheDocument();
  });

  it('renders GenericFileIcon when contentType is undefined', () => {
    render(<FileIcon />);
    const icon = screen.getByTestId('generic-file-icon');
    expect(icon).toBeInTheDocument();
  });
});