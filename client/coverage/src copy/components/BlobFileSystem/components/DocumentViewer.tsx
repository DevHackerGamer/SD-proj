import React, { useState, useEffect } from 'react';
import { fileSystemService } from '../services/FileSystemService';
import type { FileSystemItem } from '../types';
import '../styles.css';

interface DocumentViewerProps {
  item: FileSystemItem;
  onClose: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ item, onClose }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUrl = async () => {
      try {
        setLoading(true);
        const downloadUrl = await fileSystemService.getDownloadUrl(item.path);
        setUrl(downloadUrl);
        setLoading(false);
      } catch (err) {
        setError("Failed to load document");
        setLoading(false);
        console.error("Error fetching document URL:", err);
      }
    };

    fetchUrl();
  }, [item]);

  const getContentType = () => {
    const contentType = item.contentType || '';
    if (contentType.includes('pdf')) return 'pdf';
    if (contentType.includes('image')) return 'image';
    if (contentType.includes('text')) return 'text';
    if (contentType.includes('video')) return 'video';
    if (contentType.includes('audio')) return 'audio';
    return 'other';
  };

  const renderContent = () => {
    if (loading) return <div className="loading">Loading document...</div>;
    if (error) return <div className="error">{error}</div>;
    if (!url) return <div className="error">Unable to display document</div>;

    const contentType = getContentType();

    switch (contentType) {
      case 'pdf':
        return (
          <iframe 
            src={url} 
            width="100%" 
            height="100%" 
            title={item.name}
          />
        );
      case 'image':
        return <img src={url} alt={item.name} />;
      case 'video':
        return (
          <video controls width="100%">
            <source src={url} type={item.contentType} />
            Your browser does not support this video format.
          </video>
        );
      case 'audio':
        return (
          <audio controls>
            <source src={url} type={item.contentType} />
            Your browser does not support this audio format.
          </audio>
        );
      default:
        return (
          <div className="download-option">
            <p>Preview not available for this file type.</p>
            <a href={url} download={item.name} target="_blank" rel="noreferrer">
              Download File
            </a>
          </div>
        );
    }
  };

  return (
    <div className="document-viewer-overlay">
      <div className="document-viewer">
        <div className="document-header">
          <h2>{item.name}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="document-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;
