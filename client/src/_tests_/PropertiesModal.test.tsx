import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PropertiesModal from '../components/filesystem/components/PropertiesModal'; // adjust if path differs
import type { BlobItemProperties } from '../components/filesystem/types';

describe('PropertiesModal', () => {
  const mockClose = jest.fn();

  const mockProps: BlobItemProperties = {
    name: 'example.txt',
    path: '/folder/example.txt',
    isDirectory: false,
    size: 2048,
    lastModified: new Date('2024-01-01T12:00:00Z'),
    createdOn: new Date('2023-12-01T09:00:00Z'),
    etag: '0x8D...',
    contentType: 'text/plain',
    metadata: {
      author: 'John Doe',
      department: 'Research',
      isDirectoryPlaceholder: 'false'
    }
  };

  it('renders nothing if no properties, no error, and not loading', () => {
    const { container } = render(
      <PropertiesModal properties={null} onClose={mockClose} isLoading={false} error={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders loading state', () => {
    render(<PropertiesModal properties={null} onClose={mockClose} isLoading={true} error={null} />);
    expect(screen.getByText(/Loading properties.../i)).toBeInTheDocument();
  });

  it('renders error message', () => {
    render(<PropertiesModal properties={null} onClose={mockClose} isLoading={false} error="Failed to load" />);
    expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
  });

  it('renders file properties correctly', () => {
    render(<PropertiesModal properties={mockProps} onClose={mockClose} isLoading={false} error={null} />);
    
    expect(screen.getByText(/Name:/)).toBeInTheDocument();
    expect(screen.getByText('example.txt')).toBeInTheDocument();
    
    expect(screen.getByText(/Type:/)).toBeInTheDocument();
    expect(screen.getByText('text/plain')).toBeInTheDocument();

    expect(screen.getByText(/Size:/)).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();

    expect(screen.getByText(/Metadata:/)).toBeInTheDocument();
    expect(screen.getByText(/author:/i)).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('filters out isDirectoryPlaceholder from metadata', () => {
    render(<PropertiesModal properties={mockProps} onClose={mockClose} isLoading={false} error={null} />);
    expect(screen.queryByText(/isDirectoryPlaceholder/i)).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<PropertiesModal properties={mockProps} onClose={mockClose} isLoading={false} error={null} />);
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(mockClose).toHaveBeenCalled();
  });
});
