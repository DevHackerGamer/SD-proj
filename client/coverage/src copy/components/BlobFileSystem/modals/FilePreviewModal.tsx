import React, { useState, useEffect } from 'react';
import type { FileSystemItem } from '../models';
import { isFileItem } from '../models';
import { isImageFile, isVideoFile, isAudioFile, isTextFile, formatFileSize, formatDate } from '../utils';
import { FaDownload, FaFileAlt, FaImage, FaVideo, FaMusic, FaExternalLinkAlt } from 'react-icons/fa';

interface FilePreviewModalProps {
  item: FileSystemItem;
  onClose: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ item, onClose }) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Load text content for text files
  useEffect(() => {
    const loadTextContent = async () => {
      if (isTextFile(item.name) && isFileItem(item) && item.url) {
        try {
          setIsLoading(true);
          setError('');
          const response = await fetch(item.url);
          if (!response.ok) {
            throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
          }
          const text = await response.text();
          setContent(text);
        } catch (err) {
          setError(`Error loading file: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadTextContent();
  }, [item]);

  const renderPreview = () => {
    if (isLoading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
          <div style={{ 
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 2s linear infinite'
          }} />
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          borderRadius: '4px',
          margin: '20px 0'
        }}>
          <p>{error}</p>
        </div>
      );
    }

    if (!isFileItem(item) || !item.url) {
      return (
        <div style={{ 
          padding: '20px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24',
          borderRadius: '4px',
          margin: '20px 0'
        }}>
          <p>No URL available for this file.</p>
        </div>
      );
    }

    if (isImageFile(item.name)) {
      return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <img 
            src={item.url} 
            alt={item.name} 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '60vh', 
              objectFit: 'contain' 
            }} 
          />
        </div>
      );
    }

    if (isVideoFile(item.name)) {
      return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <video 
            controls 
            style={{ maxWidth: '100%', maxHeight: '60vh' }}
          >
            <source src={item.url} type={item.contentType || 'video/mp4'} />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (isAudioFile(item.name)) {
      return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <audio controls style={{ width: '100%' }}>
            <source src={item.url} type={item.contentType || 'audio/mpeg'} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }

    if (isTextFile(item.name)) {
      return (
        <div style={{ padding: '20px' }}>
          <pre 
            style={{ 
              backgroundColor: '#f8f9fa', 
              padding: '16px', 
              borderRadius: '4px',
              maxHeight: '60vh',
              overflow: 'auto',
              fontSize: '14px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            {content || 'No content to display.'}
          </pre>
        </div>
      );
    }

    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
        <FaFileAlt size={64} style={{ marginBottom: '20px' }} />
        <p>Preview not available for this file type.</p>
        <p>Download the file to view its contents.</p>
      </div>
    );
  };

  const getFileIcon = () => {
    if (isImageFile(item.name)) return <FaImage size={20} style={{ marginRight: '8px' }} color="#4caf50" />;
    if (isVideoFile(item.name)) return <FaVideo size={20} style={{ marginRight: '8px' }} color="#f44336" />;
    if (isAudioFile(item.name)) return <FaMusic size={20} style={{ marginRight: '8px' }} color="#2196f3" />;
    if (isTextFile(item.name)) return <FaFileAlt size={20} style={{ marginRight: '8px' }} color="#9c27b0" />;
    return <FaFileAlt size={20} style={{ marginRight: '8px' }} color="#607d8b" />;
  };

  // Get file attributes safely with isFileItem guard
  const getFileSize = () => {
    if (isFileItem(item) && item.size) {
      return formatFileSize(item.size);
    }
    return 'N/A';
  };

  const getFileType = () => {
    if (isFileItem(item)) {
      return item.contentType || 'Unknown';
    }
    return 'Folder';
  };

  const getModifiedDate = () => {
    if (item.lastModified) {
      return formatDate(item.lastModified);
    }
    return 'N/A';
  };

  // Only render download and external links for files
  const renderFileLinks = () => {
    if (!isFileItem(item) || !item.url) {
      return null;
    }
    
    return (
      <>
        <div style={{ marginLeft: 'auto' }}>
          <a
            href={item.url}
            download={item.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              color: '#007bff',
              textDecoration: 'none',
              marginRight: '16px'
            }}
          >
            <FaDownload size={14} style={{ marginRight: '4px' }} />
            Download
          </a>
        </div>
        <div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              color: '#28a745',
              textDecoration: 'none'
            }}
          >
            <FaExternalLinkAlt size={14} style={{ marginRight: '4px' }} />
            Open in New Tab
          </a>
        </div>
      </>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '4px',
        width: '90%',
        maxWidth: '1000px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {getFileIcon()}
            <h2 style={{ margin: 0, fontSize: '18px' }}>{item.name}</h2>
          </div>
          <div>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '22px',
                cursor: 'pointer',
                padding: '4px',
                color: '#6c757d'
              }}
            >
              ×
            </button>
          </div>
        </div>
        
        {/* File Info */}
        <div style={{
          display: 'flex',
          padding: '12px 24px',
          borderBottom: '1px solid #e0e0e0',
          backgroundColor: '#f8f9fa',
          fontSize: '14px',
          color: '#6c757d',
          gap: '24px'
        }}>
          <div>
            <strong>Size:</strong> {getFileSize()}
          </div>
          <div>
            <strong>Type:</strong> {getFileType()}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <strong>Modified:</strong> {getModifiedDate()}
          </div>
          {renderFileLinks()}
        </div>
        
        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {renderPreview()}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
