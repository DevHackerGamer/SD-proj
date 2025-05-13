import React from 'react';
import type { RefObject } from 'react'; // Use type-only import for RefObject
import styles from '../BasicFileSystem.module.css';

interface UploadSectionProps {
  isLoading: boolean;
  uploading: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  // Fix the ref type to accept null as well
  fileInputRef?: RefObject<HTMLInputElement | null>;
}

const UploadSection: React.FC<UploadSectionProps> = ({ isLoading, uploading, onFileUpload, fileInputRef }) => {
  return (
    <div className={styles.uploadSection}>
      <input
        type="file"
        id="file-upload"
        onChange={onFileUpload}
        style={{ display: 'none' }}
        ref={fileInputRef}
      />
      <label htmlFor="fileUpload">Upload File:</label>
      <input
        id="fileUpload"
        type="file"
        onChange={onFileUpload}
        disabled={isLoading || uploading}
      />
      {uploading && <span>Uploading...</span>}
    </div>
  );
};

export default UploadSection;
