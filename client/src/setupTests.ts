// setupTests.ts
import '@testing-library/jest-dom';

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  
  if (typeof document.getSelection !== 'function') {
    document.getSelection = () => ({
      toString: () => '',
      removeAllRanges: () => {},
    } as unknown as Selection);
  }
  Object.defineProperty(global, 'import', {
    value: {},
  });

  Object.defineProperty(global, 'import.meta', {
    value: {
      env: {
        VITE_USE_MOCK_ANALYSIS: 'false',//OR TRUE?
      },
    },
  });
});