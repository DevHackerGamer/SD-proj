import React, { useRef } from 'react';
import { useFileSystem } from '../context/FileSystemContext';
import { useFileUpload } from '../hooks/useFileUpload';
import { FaUpload, FaFolderPlus } from 'react-icons/fa';
import MetadataForm from './MetadataForm';
import '../styles.css';

interface ToolbarProps {
  onCreateFolder: () => void;
  onUpload: () => void;
  showUploader: boolean;
  searchTerm: string;
  onSearch: (term: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
  onCreateFolder, 
  onUpload, 
  showUploader,
  searchTerm, 
  onSearch
}) => {
  const { createDirectory } = useFileSystem();
  const { 
    isUploading, 
    showMetadataForm, 
    filesToUpload,
    prepareFilesForUpload,
    uploadFilesWithMetadata,
    cancelUpload
  } = useFileUpload();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Prepare files for upload (this will show the metadata form)
      prepareFilesForUpload(e.target.files);
      
      // Reset the input to allow selecting the same files again
      e.target.value = '';
    }
  };

  const handleMetadataSubmit = async (metadata: any, targetPath: string) => {
    // Upload files with the provided metadata to the specified path
    await uploadFilesWithMetadata(filesToUpload, targetPath, metadata);
  };

  return (
    <>
      <div className="atom-toolbar">
        <div className="toolbar-actions">
          <button 
            className="action-btn"
            onClick={onCreateFolder}
            disabled={isUploading}
          >
            <FaFolderPlus /> Create Folder
          </button>
          <button 
            className="action-btn"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            <FaUpload /> {isUploading ? 'Uploading...' : 'Upload Documents'}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
          />
        </div>
        <div className="toolbar-search">
          <input
            type="text"
            className="search-input"
            placeholder="Search in current directory..."
            value={searchTerm}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>
      
      {showMetadataForm && (
        <MetadataForm
          files={filesToUpload}
          onSubmit={handleMetadataSubmit}
          onCancel={cancelUpload}
        />
      )}
    </>
  );
};

export default Toolbar;
