// setupTests.ts
import '@testing-library/jest-dom';
beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    if (typeof document.getSelection !== 'function') {
      document.getSelection = () => ({
        toString: () => '',
        removeAllRanges: () => {},
      } as unknown as Selection);
    }
  });