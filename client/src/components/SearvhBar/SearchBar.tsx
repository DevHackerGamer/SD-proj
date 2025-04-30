import React, { useState, useMemo } from 'react';
import { useDebounce } from '../filesystem/utils/useDebounce';

export function SearchBar({ onSearch }: { onSearch: (q: string) => void }) {
  const [query, setQuery] = useState('');
  const debounced = useMemo(() => useDebounce(onSearch, 300), [onSearch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    debounced(q);
  };

  return (
    <input
      type="text"
      className="w-full p-2 border rounded mb-4"
      placeholder="Search files or folders…"
      value={query}
      onChange={handleChange}
    />
  );
}