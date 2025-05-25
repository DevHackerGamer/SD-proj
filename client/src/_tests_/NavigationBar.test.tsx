import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NavigationBar from '../components/filesystem/components/NavigationBar';

describe('NavigationBar', () => {
  const mockNavigateUp = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders current path correctly', () => {
    render(<NavigationBar currentPath="root/folder" isLoading={false} onNavigateUp={mockNavigateUp} />);
    expect(screen.getByText(/Current Path:/)).toHaveTextContent('Current Path: /root/folder');
  });

  it('calls onNavigateUp when button is clicked', () => {
    render(<NavigationBar currentPath="folder1" isLoading={false} onNavigateUp={mockNavigateUp} />);
    const upButton = screen.getByRole('button', { name: /Up \.\.\//i });
    fireEvent.click(upButton);
    expect(mockNavigateUp).toHaveBeenCalledTimes(1);
  });

  it('disables button when currentPath is empty', () => {
    render(<NavigationBar currentPath="" isLoading={false} onNavigateUp={mockNavigateUp} />);
    const upButton = screen.getByRole('button', { name: /Up \.\.\//i });
    expect(upButton).toBeDisabled();
  });

  it('disables button when loading', () => {
    render(<NavigationBar currentPath="folder2" isLoading={true} onNavigateUp={mockNavigateUp} />);
    const upButton = screen.getByRole('button', { name: /Up \.\.\//i });
    expect(upButton).toBeDisabled();
  });
});
