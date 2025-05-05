import React, { useState, useEffect } from 'react';
import type { BlobItem } from '../types';
import { fileSystemService } from '../FileSystemService'; // To get download URL
import styles from '../BasicFileSystem.module.css'; // Use shared styles for now

interface FilePreviewModalProps {
  item: BlobItem | null;
  onClose: () => void;
}

// Helper function to check if a content type is likely text-based
const isTextBasedContentType = (contentType: string | undefined): boolean => {
  if (!contentType) return false;
  return contentType.startsWith('text/') ||
         contentType === 'application/json' ||
         contentType === 'application/xml' ||
         contentType === 'application/javascript'; // Add more as needed
};

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ item, onClose }) => {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(false);
  // --- NEW: State for text content ---
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState<boolean>(false);
  // --- END NEW ---

  useEffect(() => {
    // Reset states when item changes or modal opens/closes
    setDownloadUrl(null);
    setError(null);
    setTextContent(null); // Reset text content
    setIsLoadingUrl(false);
    setIsLoadingText(false);

    if (item && !item.isDirectory) {
      setIsLoadingUrl(true);
      fileSystemService.getDownloadUrl(item.path)
        .then(url => {
          setDownloadUrl(url);
          // --- NEW: Fetch text content if applicable ---
          if (isTextBasedContentType(item.contentType)) {
            setIsLoadingText(true);
            fetch(url) // Fetch content using the SAS URL
              .then(response => {
                if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
              })
              .then(text => {
                setTextContent(text);
              })
              .catch(fetchErr => {
                console.error("Failed to fetch text content:", fetchErr);
                setError("Could not load text content for preview.");
              })
              .finally(() => {
                setIsLoadingText(false);
              });
          }
          // --- END NEW ---
        })
        .catch(err => {
          console.error("Failed to get download URL:", err);
          setError("Could not retrieve file link."); // More generic error
        })
        .finally(() => {
          setIsLoadingUrl(false);
        });
    }
  }, [item]); // Dependency array includes item

  if (!item) {
    return null; // Don't render if no item is selected
  }

  const renderPreview = () => {
    // Handle loading states first
    if (isLoadingUrl) return <p>Loading file info...</p>;
    if (error && !textContent) return <p>Could not load preview: {error}</p>; // Show error if URL/text fetch failed

    // If we have the downloadUrl (even if text fetch failed, we might show fallback)
    if (downloadUrl) {
        // Preview images directly
        if (item.contentType?.startsWith('image/')) {
          return <img src={downloadUrl} alt={item.name} className={styles.previewImage} />; // Use a class for styling
        }
        // Embed PDFs
        if (item.contentType === 'application/pdf') {
          return (
            <iframe
              src={downloadUrl}
              className={styles.previewPdf} // Use a class for styling
              title={item.name}
              frameBorder="0" // Optional: remove iframe border
            />
          );
        }
        // --- NEW: Display Text Content ---
        if (isTextBasedContentType(item.contentType)) {
          if (isLoadingText) return <p>Loading text content...</p>;
          if (textContent !== null) {
            // Use <pre> for preserving formatting
            return <pre className={styles.previewText}>{textContent}</pre>;
          }
          // If text fetch failed but we reached here, show specific error
          if (error) return <p>Could not load text content: {error}</p>;
        }
        // --- END NEW ---
    }

    // Fallback for other types or if downloadUrl is missing after load attempt
    return (
      <div>
        <p>Preview not available for this file type ({item.contentType || 'unknown'}).</p>
        <p>Filename: {item.name}</p>
        <p>Size: {item.size ? `${(item.size / 1024).toFixed(1)} KB` : 'N/A'}</p>
      </div>
    );
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <button className={styles.modalCloseButton} onClick={onClose}>×</button>
        <h3>Preview: {item.name}</h3>
        <div className={styles.modalPreviewArea}>
          {renderPreview()}
        </div>
        <div className={styles.modalActions}>
          {/* Display error more prominently if it prevents download */}
          {error && !downloadUrl && <p className={`${styles.error} ${styles.inlineError}`}>{error}</p>}
          {isLoadingUrl && <p>Loading download link...</p>}
          {downloadUrl && (
            <a
              href={downloadUrl}
              download={item.name} // Suggest original filename for download
              target="_blank" // Open in new tab might be safer depending on browser behavior
              rel="noopener noreferrer"
              className={styles.modalDownloadButton}
            >
              Download
            </a>
          )}
          {!downloadUrl && !isLoadingUrl && !error && (
             <button disabled className={styles.modalDownloadButton}>Download Unavailable</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
