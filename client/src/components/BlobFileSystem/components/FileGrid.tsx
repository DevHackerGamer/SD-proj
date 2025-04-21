import React from 'react';
import { useFileSystem } from '../context/FileSystemContext';
import type { FileSystemItem } from '../types';
import '../styles.css';

interface FileGridProps {
  onItemDoubleClick: (item: FileSystemItem) => void;
}

const FileGrid: React.FC<FileGridProps> = ({ onItemDoubleClick }) => {
  const { items, selectedItems, selectItem } = useFileSystem();

  return (
    <div className="file-grid">
      {items.length === 0 && (
        <div className="empty-directory">This directory is empty</div>
      )}
      
      {items.map(item => (
        <div
          key={item.id}
          className={`grid-item ${selectedItems.includes(item.id) ? 'selected' : ''}`}
          onClick={(e) => selectItem(item.id, e.ctrlKey || e.metaKey)}
          onDoubleClick={() => onItemDoubleClick(item)}
        >
          <div className="item-icon">
            {item.isDirectory ? '📁' : '📄'}
          </div>
          <div className="item-name">{item.name}</div>
        </div>
      ))}
    </div>
  );
};

export default FileGrid;