import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterLogicSelector from '../components/filesystem/components/FilterLogicSelector';

describe('FilterLogicSelector', () => {
  const onChangeMock = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders the component with AND selected', () => {
    render(<FilterLogicSelector filterLogic="AND" onChange={onChangeMock} />);
    expect(screen.getByText('Filter Logic')).toBeInTheDocument();
    expect(screen.getByText('AND')).toBeInTheDocument();
    expect(screen.getByText('OR')).toBeInTheDocument();
    expect(screen.getByText(/Example: Documents about both/i)).toBeInTheDocument();
  });

  test('renders the component with OR selected', () => {
    render(<FilterLogicSelector filterLogic="OR" onChange={onChangeMock} />);
    expect(screen.getByText(/Example: Documents about either/i)).toBeInTheDocument();
  });

  test('calls onChange when AND is clicked', () => {
    render(<FilterLogicSelector filterLogic="OR" onChange={onChangeMock} />);
    const andButton = screen.getByText('AND');
    fireEvent.click(andButton);
    expect(onChangeMock).toHaveBeenCalledWith('AND');
  });

  test('calls onChange when OR is clicked', () => {
    render(<FilterLogicSelector filterLogic="AND" onChange={onChangeMock} />);
    const orButton = screen.getByText('OR');
    fireEvent.click(orButton);
    expect(onChangeMock).toHaveBeenCalledWith('OR');
  });

  test('does not call onChange when disabled', () => {
    render(<FilterLogicSelector filterLogic="AND" onChange={onChangeMock} disabled />);
    const orButton = screen.getByText('OR');
    fireEvent.click(orButton);
    expect(onChangeMock).not.toHaveBeenCalled();
  });

  test('applies custom className if provided', () => {
    const { container } = render(
      <FilterLogicSelector filterLogic="AND" onChange={onChangeMock} className="custom-class" />
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
