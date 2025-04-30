import React from 'react';
import { useFileSystem } from '../context/FileSystemContext';
//import { FileIcon, FolderIcon } from './Icons'; // Assuming Icons are correctly imported
import type { FileSystemItem } from '../types';
//import { formatFileSize, formatDate } from '../utils/formatters'; // Assuming formatters exist

interface FileListProps {
  // Remove props related to interaction if they are no longer needed by parent
  // onItemDoubleClick: (item: FileSystemItem) => void;
  // selectedPaths: Set<string>;
  // onItemSelect: (itemPath: string, event: React.MouseEvent) => void;
}

// Adjust props destructuring if interface changed
const FileList: React.FC<FileListProps> = (/* { onItemDoubleClick, selectedPaths, onItemSelect } */) => {
  // Remove sortConfig if handleSort and getSortIndicator are removed
  const { items /*, currentDirectory, sortItems, sortConfig */ } = useFileSystem();

  // Remove sorting functions
  // const handleSort = (key: keyof FileSystemItem | 'size' | 'lastModified') => {
  //   sortItems(key);
  // };
  // const getSortIndicator = (key: keyof FileSystemItem | 'size' | 'lastModified') => {
  //   if (sortConfig.key !== key) return '';
  //   return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  // };

  return (
    <div className="file-list-container">
      <table className="file-list-table">
        <thead>
          <tr>
            {/* Remove onClick handlers from headers */}
            <th className="col-icon"></th> {/* Icon column */}
            <th className="col-name">
              Name{/* {getSortIndicator('name')} */}
            </th>
            <th className="col-size">
              Size{/* {getSortIndicator('size')} */}
            </th>
            <th className="col-date">
              Date Modified{/* {getSortIndicator('lastModified')} */}
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Ensure items are available before mapping */}
          {items && items.map((item) => (
            <tr
              key={item.id}
              // Remove event handlers and className logic for selection
              // onDoubleClick={() => onItemDoubleClick(item)}
              // onClick={(e) => onItemSelect(item.path, e)}
              // className={selectedPaths.has(item.path) ? 'selected' : ''}
            >
              {/* Replace Icon components with placeholders */}
              <td className="col-icon">
                {item.isDirectory ? '📁' : '📄'} {/* Placeholder: Folder or File emoji */}
              </td>
              <td className="col-name">{item.name}</td>
              {/* Replace formatter calls with placeholders or raw data */}
              <td className="col-size">{!item.isDirectory ? (item.size ?? '--') : '--'}</td>
              <td className="col-date">{(item.lastModified?.toString() ?? '--')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Optional: Add loading/empty state display if needed */}
      {/* {isLoading && <div>Loading...</div>} */}
      {/* {!isLoading && items && items.length === 0 && <div>Folder is empty.</div>} */}
    </div>
  );
};

export default FileList;v