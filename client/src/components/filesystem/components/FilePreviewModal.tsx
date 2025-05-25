import React, { useState, useEffect } from 'react';
import type { BlobItem } from '../types';
import styles from '../BasicFileSystem.module.css';
import { fileSystemService } from '../FileSystemService'; // Import the service
import path from 'path-browserify'; // Import path-browserify

interface FilePreviewModalProps {
  item: BlobItem | null;
  onClose: () => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ item, onClose }) => {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sasUrl, setSasUrl] = useState<string | null>(null); // Keep SAS URL for non-text types

  useEffect(() => {
    if (!item || item.isDirectory) {
      setContent(null);
      setSasUrl(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setContent(null); // Reset content
    setSasUrl(null); // Reset SAS URL

    const fetchContent = async () => {
      try {
        // --- Fetch SAS URL first (needed for images/PDFs and download link) ---
        const url = await fileSystemService.getDownloadUrl(item.path);
        setSasUrl(url);
        console.log(`[PreviewModal] Got SAS URL for ${item.name}`);
        // --- End Fetch SAS URL ---

        // --- Check if it's metadata.json ---
        if (item.name === 'metadata.json' && item.contentType?.includes('json')) {
            console.log(`[PreviewModal] Fetching metadata content via service for ${item.path}`);
            // Use the service to get metadata content via backend proxy
            const metadataContent = await fileSystemService.getMetadataJson(item.path);
            setContent(JSON.stringify(metadataContent, null, 2)); // Pretty print JSON
            console.log(`[PreviewModal] Successfully fetched metadata content for ${item.path}`);
        }
        // --- REMOVE direct fetch for text/* ---
        // else if (item.contentType?.startsWith('text/')) {
        //   console.log(`[PreviewModal] Fetching text content directly using SAS URL for ${item.name}`);
        //   // Fetch text content directly using the SAS URL (CORS *might* be configured for GET on text/*)
        //   // If this still fails CORS, text files would also need backend proxying
        //   const response = await fetch(url); // Use the fetched SAS URL
        //   if (!response.ok) {
        //     throw new Error(`HTTP error! status: ${response.status}`);
        //   }
        //   const textContent = await response.text();
        //   setContent(textContent);
        //   console.log(`[PreviewModal] Successfully fetched text content for ${item.name}`);
        // }
        // --- END REMOVE ---
        // --- For non-text/non-metadata types, we just need the SAS URL (handled above) ---
        else if (!item.contentType?.startsWith('text/')) { // Added condition to be explicit
             console.log(`[PreviewModal] Non-text/metadata file type (${item.contentType}), using SAS URL directly for rendering.`);
             // No need to fetch content here, the URL is used in the iframe/img src
        } else {
            // Handle text files now - no inline preview, rely on fallback
            console.log(`[PreviewModal] Text file type (${item.contentType}), inline preview disabled due to potential CORS. Use download link.`);
        }


      } catch (err: any) {
        console.error(`[PreviewModal] Failed to fetch content for ${item.name}:`, err);
        const message = err instanceof Error ? err.message : String(err);
        setError(`Failed to load preview: ${message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();

  }, [item]); // Dependency array includes item

  if (!item) {
    return null;
  }

  const renderContent = () => {
    if (isLoading) {
      return <div className={styles.loading}>Loading preview...</div>;
    }
    if (error) {
      return <div className={styles.error}>{error}</div>;
    }
    if (!sasUrl && !content) { // If no URL and no text content
        return <div className={styles.error}>Could not load preview content.</div>;
    }

    // Use content state ONLY for metadata.json (since text fetch was removed)
    if (content && item?.name === 'metadata.json') {
      return <pre className={styles.previewTextContent}>{content}</pre>;
    }

    // Use sasUrl for other types (images, pdf)
    if (sasUrl) {
        if (item?.contentType?.startsWith('image/')) {
          return <img src={sasUrl} alt={item.name} style={{ maxWidth: '100%', maxHeight: '80vh' }} />;
        }
        if (item?.contentType === 'application/pdf') {
          return <iframe  allow="fullscreen" src={sasUrl} title={item.name} style={{ width: '100%', height: '80vh', border: 'none' }}></iframe>;
        }
        // Add other preview types if needed (e.g., video, audio)
        // ...
    }

    // Fallback for text files and other non-previewable types
    // Ensure sasUrl exists for the download link
    const downloadUrl = sasUrl || '#'; // Use '#' as fallback if URL fetch failed
    const typeMessage = item?.contentType ? `(${item.contentType})` : '';
    return <p>Preview not available for this file type {typeMessage}. <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download={item?.name}>Download file</a></p>;
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div role = "dialog" data-testid="modal-content" className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h3>Preview: {item.name}</h3>
        <button className={styles.modalCloseButton} onClick={onClose}>×</button>
        <div data-testid=" preview-area"className={styles.previewArea}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
