import React from 'react';

// Basic Folder Icon
export const FolderIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a5a5a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

// --- NEW: Specific PDF Icon ---
const PdfIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d9534f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="12" y1="18" x2="12" y2="12"></line>
    <line x1="9" y1="15" x2="15" y2="15"></line>
    {/* Simple 'PDF' text approximation */}
    <path d="M10 12h1v6h-1z"></path>
    <path d="M13 18h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-1v6z"></path>
    <path d="M16 18h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1h-1v6z"></path>
  </svg>
);

// --- NEW: Generic File Icon ---
const GenericFileIcon: React.FC = () => (
   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6c757d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
    <polyline points="13 2 13 9 20 9"></polyline>
  </svg>
);


// --- Updated FileIcon to be conditional ---
interface FileIconProps {
  contentType?: string;
}
export const FileIcon: React.FC<FileIconProps> = ({ contentType }) => {
  if (contentType?.includes('pdf')) {
    return <PdfIcon />;
  }
  // Add more conditions here for other types (e.g., image, text)
  // else if (contentType?.startsWith('image/')) { return <ImageIcon />; }
  // else if (contentType?.startsWith('text/')) { return <TextIcon />; }

  // Fallback to generic file icon
  return <GenericFileIcon />;
};

// --- REMOVED Action Icons ---
// export const DownloadIcon: React.FC = () => ( ... );
// export const DeleteIcon: React.FC = () => ( ... );
