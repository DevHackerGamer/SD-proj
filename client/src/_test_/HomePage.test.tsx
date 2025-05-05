// HomePage.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from '../pages/HomePage';

// Mock Clerk components used in HomePage (if rendered)
jest.mock('@clerk/clerk-react', () => ({
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <div>UserButton</div>,
  SignInButton: () => <button>Sign In</button>,
}));

describe('HomePage Component', () => {
  test('renders search input and button', () => {
    render(<HomePage />);
    expect(screen.getByPlaceholderText(/Search for something/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
  });

  test('submits search with valid input', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    render(<HomePage />);
    
    const input = screen.getByPlaceholderText(/Search for something/i);
    const button = screen.getByRole('button', { name: /search/i });

    fireEvent.change(input, { target: { value: 'Test search' } });
    fireEvent.click(button);

    expect(consoleLogSpy).toHaveBeenCalledWith('Searching for: Test search');

    consoleLogSpy.mockRestore();
  });

  test('shows error on empty search', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    render(<HomePage />);
    
    const button = screen.getByRole('button', { name: /search/i });
    fireEvent.click(button);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Search query cannot be empty.');

    consoleErrorSpy.mockRestore();
  });
});
