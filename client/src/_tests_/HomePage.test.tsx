// HomePage.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import HomePage from '../pages/HomePage';

// Mock Clerk components used in HomePage
jest.mock('@clerk/clerk-react', () => ({
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton: () => <div>UserButton</div>,
  SignInButton: () => <button>Sign In</button>,
}));

// Silence console.log and console.error
beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue([]),
  });
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  (console.log as jest.Mock).mockRestore?.();
  (console.error as jest.Mock).mockRestore?.();
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

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Search query cannot be empty.');
    consoleErrorSpy.mockRestore();
  });

  test('handles API failure gracefully', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to query Pinecone'));

    render(<HomePage />);

    const input = screen.getByTestId("search-input");
    const button = screen.getByTestId("search-button");

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Test search' } });
      fireEvent.click(button);
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to fetch results. Please try again.')
    );
    consoleErrorSpy.mockRestore();
  });

  test('renders results when API returns data', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          text: 'This is a result from Pinecone',
          link: 'https://example.com/document.pdf',
        },
      ],
    });

    render(<HomePage />);
    const input = screen.getByTestId('search-input');
    const button = screen.getByTestId('search-button');

    fireEvent.change(input, { target: { value: 'Pinecone' } });

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(screen.getByText(/this is a result from pinecone/i)).toBeInTheDocument();
      expect(screen.getByText(/view file/i)).toHaveAttribute('href', 'https://example.com/document.pdf');
    });
  });

  test('submits search using only tags', async () => {
    render(<HomePage />);

    const tagButton = screen.getByText(/Children Rights/i);
    fireEvent.click(tagButton);

    const button = screen.getByTestId('search-button');

    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/pinecone/query',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ queryText: 'Children Rights' }),
        })
      );
    });
  });
});
