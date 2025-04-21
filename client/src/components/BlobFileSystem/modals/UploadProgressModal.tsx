import React from 'react';
import { useFileSystem } from '../context/FileSystemContext';
import type { UploadProgressInfo } from '../models';
import '../styles.css';

const UploadProgressModal: React.FC = () => {
  const { uploadProgress } = useFileSystem();
  
  if (uploadProgress.length === 0) {
    return null;
  }
  
  return (
    <div className="upload-progress-modal">
      <div className="upload-progress-header">
        <h3>Uploading Files</h3>
      </div>
      
      <div className="upload-progress-items">
        {uploadProgress.map((item: UploadProgressInfo) => (
          <div key={item.fileName} className="upload-progress-item">
            <div className="file-details">
              <div className="file-name">{item.fileName}</div>
              <div className="file-status">{item.status}</div>
            </div>
            
            <div className="progress-bar-container">
              <div 
                className="progress-bar" 
                style={{ width: `${item.progress}%` }}
              ></div>
            </div>
            
            <div className="progress-text">
              {item.progress}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UploadProgressModal;
