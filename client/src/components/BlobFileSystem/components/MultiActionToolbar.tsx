import React from 'react';
import { FaDownload, FaTrashAlt, FaTimes } from 'react-icons/fa';
import { fileSystemService } from '../services/FileSystemService';
import '../styles.css';

interface MultiActionToolbarProps {
  selectedItems: any[];
  onRequestDelete: () => void;
  onSelectionClear: () => void;
}

const MultiActionToolbar: React.FC<MultiActionToolbarProps> = ({
  selectedItems,
  onRequestDelete,
  onSelectionClear
}) => {
  const handleDownloadZip = async () => {
    try {
      // Get paths of all selected items
      const paths = selectedItems.map(item => item.path);
      
      // Create a fallback implementation if the method doesn't exist
      let downloadUrl;
      try {
        // Try to use the service method if available
        downloadUrl = await fileSystemService.downloadAsZip(paths);
      } catch (error) {
        console.error('Error using downloadAsZip, using fallback:', error);
        
        // Fallback implementation - use fetch API directly
        const response = await fetch('/api/blob/download-zip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: paths })
        });
        
        if (!response.ok) {
          throw new Error(`Download ZIP failed: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        downloadUrl = URL.createObjectURL(blob);
      }
      
      // Create a temporary link to download the file
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'archive.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up the object URL if we created one
      if (downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(downloadUrl);
      }
    } catch (error) {
      console.error('Error downloading as ZIP:', error);
      alert('Failed to download files as ZIP');
    }
  };

  return (
    <div className="multi-action-toolbar">
      <div className="selected-count">
        {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} selected
      </div>
      
      <div className="action-buttons">
        <button
          className="action-btn download-zip-btn"
          onClick={handleDownloadZip}
          title="Download selected items as ZIP"
        >
          <FaDownload /> Download as ZIP
        </button>
        
        <button
          className="action-btn delete-btn"
          onClick={onRequestDelete}
          title="Delete selected items"
        >
          <FaTrashAlt /> Delete
        </button>
        
        <button
          className="action-btn cancel-btn"
          onClick={onSelectionClear}
          title="Clear selection"
        >
          <FaTimes /> Cancel
        </button>
      </div>
    </div>
  );
};

export default MultiActionToolbar;
