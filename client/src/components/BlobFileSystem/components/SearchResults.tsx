import React from 'react';
import { FaFolder, FaFile, FaTimes } from 'react-icons/fa';
import type { FileSystemItem } from '../types';
import '../styles.css';

interface SearchResultsProps {
  searchTerm: string;
  onItemClick: (item: any) => void;
  onClose: () => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({ 
  searchTerm, 
  onItemClick, 
  onClose 
}) => {
  // Mock search results for now
  const results = [
    { id: '1', name: 'Sample Result 1.pdf', path: 'south_africa/1996_constitution/sample1.pdf', isDirectory: false },
    { id: '2', name: 'Sample Directory', path: 'south_africa/1996_constitution/amendments', isDirectory: true }
  ];

  return (
    <div className="atom-search-results">
      <div className="search-results-header">
        <h3>Search Results: "{searchTerm}"</h3>
        <button className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      
      <div className="search-results-count">
        Found {results.length} result{results.length !== 1 ? 's' : ''}
      </div>
      
      <div className="search-results-list">
        {results.map(item => (
          <div
            key={item.id}
            className="search-result-item"
            onClick={() => onItemClick(item)}
          >
            <div className="result-icon">
              {item.isDirectory ? <FaFolder /> : <FaFile />}
            </div>
            <div className="result-details">
              <div className="search-result-name">{item.name}</div>
              <div className="search-result-path">Path: {item.path}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchResults;
