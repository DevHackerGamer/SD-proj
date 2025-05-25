import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchBar from '../components/filesystem/components/SearchBar';

describe('SearchBar', () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    mockOnSearch.mockClear();
  });

  it('renders the search input and buttons', () => {
    render(<SearchBar onSearch={mockOnSearch} isSearching={false} />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('search-button')).toBeInTheDocument();
    expect(screen.getByTestId('filter-button')).toBeInTheDocument();
  });

  it('calls onSearch with query when search button is clicked', () => {
    render(<SearchBar onSearch={mockOnSearch} isSearching={false} />);
    const input = screen.getByTestId('search-input');
    fireEvent.change(input, { target: { value: 'report' } });
    fireEvent.click(screen.getByTestId('search-button'));

    expect(mockOnSearch).toHaveBeenCalledWith('report', expect.any(Object));
  });

  it('clears the input and filters when clear button is clicked', () => {
    render(<SearchBar onSearch={mockOnSearch} isSearching={false} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'log' } });
    fireEvent.click(screen.getByTestId('search-button'));

    expect(screen.getByDisplayValue('log')).toBeInTheDocument();

    const clearButton = screen.getByTestId('clear-button');
    fireEvent.click(clearButton);

    expect(screen.queryByDisplayValue('log')).not.toBeInTheDocument();
    expect(mockOnSearch).toHaveBeenCalledWith('', {
      fileTypes: [],
      modifiedAfter: null,
      modifiedBefore: null,
      minSize: null,
      maxSize: null,
    });
  });

  it('toggles filter panel visibility', () => {
    render(<SearchBar onSearch={mockOnSearch} isSearching={false} />);
    expect(screen.queryByText(/file types/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('filter-button'));
    expect(screen.getByText(/file types/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('filter-button'));
    expect(screen.queryByText(/file types/i)).not.toBeInTheDocument();
  });

  it('updates file type filters and applies them', () => {
    render(<SearchBar onSearch={mockOnSearch} isSearching={false} />);
    fireEvent.click(screen.getByTestId('filter-button'));

    const imagesCheckbox = screen.getByLabelText(/images/i);
    fireEvent.click(imagesCheckbox);

    fireEvent.click(screen.getByText(/apply filters/i));

    expect(mockOnSearch).toHaveBeenCalledWith('', expect.objectContaining({
      fileTypes: ['images'],
    }));
  });

  it('sets date filters and applies them', () => {
    render(<SearchBar onSearch={mockOnSearch} isSearching={false} />);
    fireEvent.click(screen.getByTestId('filter-button'));

    const fromDate = screen.getAllByPlaceholderText(/from/i)[0];
    const toDate = screen.getAllByPlaceholderText(/to/i)[0];

    fireEvent.change(fromDate, { target: { value: '2023-01-01' } });
    fireEvent.change(toDate, { target: { value: '2023-12-31' } });

    fireEvent.click(screen.getByText(/apply filters/i));

    expect(mockOnSearch).toHaveBeenCalledWith('', expect.objectContaining({
      modifiedAfter: new Date('2023-01-01'),
      modifiedBefore: new Date('2023-12-31'),
    }));
  });
});