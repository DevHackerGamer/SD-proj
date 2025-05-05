import React from 'react';
import styles from '../BasicFileSystem.module.css'; // Use parent's styles

interface UploadSectionProps {
  isLoading: boolean;
  uploading: boolean;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const UploadSection: React.FC<UploadSectionProps> = ({ isLoading, uploading, onFileUpload }) => {
  return (
    <div className={styles.uploadSection}>
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
