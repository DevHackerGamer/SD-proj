import React from 'react';
import type { BlobItemProperties } from '../types';
import styles from '../BasicFileSystem.module.css'; // Reuse styles or create new ones

interface PropertiesModalProps {
  properties: BlobItemProperties | null;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
}

const PropertiesModal: React.FC<PropertiesModalProps> = ({
  properties,
  onClose,
  isLoading,
  error,
}) => {
  if (!properties && !isLoading && !error) {
    return null; // Don't render if no properties, not loading, and no error
  }

  const formatBytes = (bytes?: number, decimals = 2) => {
    if (bytes === undefined || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatDate = (date?: Date) => {
    return date ? new Date(date).toLocaleString() : 'N/A';
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>Properties</h2>
        <button className={styles.modalCloseButton} onClick={onClose}>×</button>

        {isLoading && <div className={styles.loading}>Loading properties...</div>}
        {error && <div className={styles.error}>{error}</div>}

        {properties && !isLoading && !error && (
          <div className={styles.propertiesDetails}>
            <p><strong>Name:</strong> {properties.name}</p>
            <p><strong>Path:</strong> {properties.path}</p>
            <p><strong>Type:</strong> {properties.isDirectory ? 'Folder' : properties.contentType || 'File'}</p>
            {!properties.isDirectory && <p><strong>Size:</strong> {formatBytes(properties.size)}</p>}
            <p><strong>Last Modified:</strong> {formatDate(properties.lastModified)}</p>
            <p><strong>Created On:</strong> {formatDate(properties.createdOn)}</p>
            {properties.etag && <p><strong>ETag:</strong> {properties.etag}</p>}

            {properties.metadata && Object.keys(properties.metadata).length > 0 && (
              <div>
                <strong>Metadata:</strong>
                <ul>
                  {Object.entries(properties.metadata).map(([key, value]) => (
                    // Avoid rendering internal placeholder metadata
                    key !== 'isDirectoryPlaceholder' && <li key={key}><em>{key}:</em> {value}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertiesModal;
