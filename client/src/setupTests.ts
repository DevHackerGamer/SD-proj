// setupTests.ts
import '@testing-library/jest-dom';
beforeAll(() => {
    if (typeof document.getSelection !== 'function') {
      document.getSelection = () => ({
        toString: () => '',
        removeAllRanges: () => {},
      } as unknown as Selection);
    }
  });
  