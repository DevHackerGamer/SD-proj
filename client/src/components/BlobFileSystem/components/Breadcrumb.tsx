import React from 'react';
import { FaHome, FaList, FaTh } from 'react-icons/fa';
import '../styles.css';

interface BreadcrumbProps {
  currentDirectory: string;
  onNavigate: (path: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
  currentDirectory,
  onNavigate,
  viewMode,
  onViewModeChange
}) => {
  // Create breadcrumb segments
  const segments = currentDirectory
    ? [{ name: 'Home', path: '' }, ...currentDirectory.split('/').map((part, index, arr) => {
        const path = arr.slice(0, index + 1).join('/');
        return { name: part, path };
      })]
    : [{ name: 'Home', path: '' }];

  return (
    <div className="breadcrumb-container">
      <div className="breadcrumb-trail">
        {segments.map((segment, index) => (
          <React.Fragment key={segment.path}>
            {index > 0 && <span className="breadcrumb-separator">/</span>}
            <button
              className="breadcrumb-item"
              onClick={() => onNavigate(segment.path)}
            >
              {index === 0 ? <FaHome /> : segment.name}
            </button>
          </React.Fragment>
        ))}
      </div>
      
      <div className="view-controls">
        <button
          className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => onViewModeChange('list')}
          title="List view"
        >
          <FaList />
        </button>
        <button
          className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => onViewModeChange('grid')}
          title="Grid view"
        >
          <FaTh />
        </button>
      </div>
    </div>
  );
};

export default Breadcrumb;