import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import NavigationHistory from '../components/filesystem/components/NavigationHistory';

describe('NavigationHistory', () => {
  const mockNavigate = jest.fn();
  const mockBack = jest.fn();
  const mockForward = jest.fn();

  const history = ['/root', '/root/folder1', '/root/folder1/subfolder'];
  const setup = (index: number) => {
    render(
      <NavigationHistory
        history={history}
        currentIndex={index}
        onNavigate={mockNavigate}
        onBack={mockBack}
        onForward={mockForward}
      />
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders back and forward buttons with correct disabled states', () => {
    setup(0); // Start of history

    const backButton = screen.getByTitle(/Go Back/i);
    const forwardButton = screen.getByTitle(/Go Forward/i);

    expect(backButton).toBeDisabled();
    expect(forwardButton).not.toBeDisabled();
  });

  it('calls onBack when back button is clicked', () => {
    setup(2);
    const backButton = screen.getByTitle(/Go Back/i);
    fireEvent.click(backButton);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('calls onForward when forward button is clicked', () => {
    setup(1);
    const forwardButton = screen.getByTitle(/Go Forward/i);
    fireEvent.click(forwardButton);
    expect(mockForward).toHaveBeenCalledTimes(1);
  });

  it('renders all history items in the dropdown', () => {
    setup(1);
    const historyButton = screen.getByTitle(/History/i);
    fireEvent.click(historyButton); // To simulate dropdown reveal if needed (purely stylistic here)

    const items = screen.getAllByRole('button').filter((btn) =>
      history.includes(btn.textContent || '')
    );

    expect(items.length).toBe(history.length);
    history.forEach((path) => {
      expect(screen.getByText(path)).toBeInTheDocument();
    });
  });

  it('calls onNavigate when a history item is clicked', () => {
    setup(1);
    const historyItem = screen.getByText('/root');
    fireEvent.click(historyItem);
    expect(mockNavigate).toHaveBeenCalledWith('/root');
  });

  it('shows current history item with special style', () => {
    setup(2);
    const currentItem = screen.getByText('/root/folder1/subfolder');
    expect(currentItem.className).toMatch(/currentHistoryItem/);
  });
});
