import React, { useState, useEffect, useRef } from 'react';
import { FaSearch, FaFilter, FaTimes } from 'react-icons/fa';
import styles from '../BasicFileSystem.module.css';

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  isSearching: boolean;
}

export interface SearchFilters {
  fileTypes: string[];
  modifiedAfter: Date | null;
  modifiedBefore: Date | null;
  minSize: number | null;
  maxSize: number | null;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isSearching }) => {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    fileTypes: [],
    modifiedAfter: null,
    modifiedBefore: null,
    minSize: null,
    maxSize: null
  });
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Focus search input when component mounts
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);
  
  const handleSearch = () => {
    onSearch(query, filters);
  };
  
  const clearSearch = () => {
    setQuery('');
    setFilters({
      fileTypes: [],
      modifiedAfter: null,
      modifiedBefore: null,
      minSize: null,
      maxSize: null
    });
    onSearch('', {
      fileTypes: [],
      modifiedAfter: null,
      modifiedBefore: null,
      minSize: null,
      maxSize: null
    });
  };
  
  return (
    <div className={styles.searchContainer}>
      <div className={styles.searchInputContainer}>
        <input
          ref={searchInputRef}
          type="text"
          className={styles.searchInput}
          placeholder="Search files and folders..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          data-testid="search-input"   
        />
        
        {query && (
          <button 
            className={styles.searchClearButton} 
            onClick={clearSearch}
            title="Clear search"
            data-testid="clear-button" 
          >
            <FaTimes />
          </button>
        )}
        
        <button 
          className={styles.searchButton} 
          onClick={handleSearch}
          disabled={isSearching}
          title="Search"
          data-testid="search-button" 
        >
          <FaSearch />
        </button>
        
        <button 
          className={`${styles.filterButton} ${showFilters ? styles.filterActive : ''}`} 
          onClick={() => setShowFilters(!showFilters)}
          title="Show filters"
          data-testid="filter-button" 
        >
          <FaFilter />
        </button>
      </div>
      
      {showFilters && (
        <div className={styles.filtersPanel}>
          <div className={styles.filterSection}>
            <h4>File Types</h4>
            <div className={styles.filterCheckboxes}>
              {['Images', 'Documents', 'Videos', 'Audio'].map(type => (
                <label key={type} className={styles.filterCheckbox}>
                  <input 
                    type="checkbox" 
                    checked={filters.fileTypes.includes(type.toLowerCase())} 
                    onChange={(e) => {
                      const newTypes = e.target.checked 
                        ? [...filters.fileTypes, type.toLowerCase()]
                        : filters.fileTypes.filter(t => t !== type.toLowerCase());
                      setFilters({...filters, fileTypes: newTypes});
                    }}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>
          
          <div className={styles.filterSection}>
            <h4>Date Modified</h4>
            <div className={styles.filterDateRange}>
              <input 
                type="date" 
                placeholder="From" 
                value={filters.modifiedAfter ? filters.modifiedAfter.toISOString().split('T')[0] : ''} 
                onChange={(e) => {
                  setFilters({
                    ...filters, 
                    modifiedAfter: e.target.value ? new Date(e.target.value) : null
                  });
                }}
              />
              <span>to</span>
              <input 
                type="date" 
                placeholder="To" 
                value={filters.modifiedBefore ? filters.modifiedBefore.toISOString().split('T')[0] : ''} 
                onChange={(e) => {
                  setFilters({
                    ...filters, 
                    modifiedBefore: e.target.value ? new Date(e.target.value) : null
                  });
                }}
              />
            </div>
          </div>
          
          <div className={styles.filterActions}>
            <button 
              className={styles.filterReset} 
              onClick={() => {
                setFilters({
                  fileTypes: [],
                  modifiedAfter: null,
                  modifiedBefore: null,
                  minSize: null,
                  maxSize: null
                });
              }}
              data-testid="reset-filters-button" 
            >
              Reset Filters
            </button>
            <button 
              className={styles.filterApply} 
              onClick={handleSearch}
              data-testid="-apply-filters-button" 
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
