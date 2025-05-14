// HomePage.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import HomePage from '../pages/HomePage';

// Mock Clerk components used in HomePage (if rendered)
jest.mock('@clerk/clerk-react', () => ({
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <div>UserButton</div>,
  SignInButton: () => <button>Sign In</button>,
}));

// Mock Pinecone API
beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,  // Simulate a successful response
    status: 200,
    json: jest.fn().mockResolvedValue([]),// Mock the JSON response(empty array for tests)
  });
});

describe('HomePage Component', () => {
  test('renders search input and button', () => {
    render(<HomePage />);
    expect(screen.getByPlaceholderText(/Search for documents, cases, or events/i)).toBeInTheDocument();
    expect(screen.getByTestId("search-button")).toBeInTheDocument();
  });

  test('submits search with valid input', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    render(<HomePage />);
    
    const input = screen.getByTestId("search-input");
    const button = screen.getByTestId("search-button");

    fireEvent.change(input, { target: { value: 'Test search' } });

    // Wrap the fireEvent inside act()
    await act(async () => {
      fireEvent.click(button);
    });

    expect(consoleLogSpy).toHaveBeenCalledWith('Searching for: Test search');

    consoleLogSpy.mockRestore();
  });

  test('shows error on empty search', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    render(<HomePage />);
    
    const button = screen.getByTestId("search-button");

    // Wrap the fireEvent inside act()
    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Search query cannot be empty.');

    consoleErrorSpy.mockRestore();
  });

  test('handles API failure gracefully', async () => {
    // Mock fetch to simulate a failed API request
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to query Pinecone'));

    render(<HomePage />);

    const input = screen.getByTestId("search-input");
    const button = screen.getByTestId("search-button");

    // Wrap the fireEvent inside act()
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Test search' } });
      fireEvent.click(button);
    });

    // Wait for the error message (from API failure) to appear
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch results. Please try again.'));
  });
});