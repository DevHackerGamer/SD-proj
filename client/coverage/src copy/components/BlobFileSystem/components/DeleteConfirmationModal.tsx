import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import type { FileSystemItem } from '../../types';

describe('<DeleteConfirmationModal />', () => {
  const mockItems: FileSystemItem[] = [
    { id: '1', name: 'Document.txt', isDirectory: false },
    { id: '2', name: 'Photos', isDirectory: true },
  ];

  const onConfirmMock = vi.fn();
  const onCancelMock = vi.fn();

  it('renders modal with correct title and items', () => {
    render(
      <DeleteConfirmationModal
        itemsToDelete={mockItems}
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
      />
    );

    // Check modal title
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();

    // Check paragraph content
    expect(screen.getByText((content) =>
      content.startsWith('Are you sure you want to delete the following')
    )).toBeInTheDocument();

    // Check individual item names
    expect(screen.getByText('Document.txt')).toBeInTheDocument();
    expect(screen.getByText('Photos')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', () => {
    render(
      <DeleteConfirmationModal
        itemsToDelete={mockItems}
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Delete button is clicked', () => {
    render(
      <DeleteConfirmationModal
        itemsToDelete={mockItems}
        onConfirm={onConfirmMock}
        onCancel={onCancelMock}
      />
    );

    fireEvent.click(screen.getByText('Delete'));
    expect(onConfirmMock).toHaveBeenCalledTimes(1);
  });
});
