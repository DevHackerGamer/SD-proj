import { useRef } from 'react';

export function useDebounce<F extends (...args: any[]) => void>(fn: F, delay = 300) {
  const timeout = useRef<number>(0);
  return (...args: Parameters<F>) => {
    clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => fn(...args), delay);
  };
}