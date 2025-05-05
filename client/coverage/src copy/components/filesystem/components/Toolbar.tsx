import React from 'react';
import styles from '../BasicFileSystem.module.css';
// Import necessary icons
import {
  FaTrashAlt,
  FaDownload,
  FaFolderPlus,
  FaEdit,
  FaCut,
  FaCopy,
  FaPaste,
  FaCheck,
  FaTimes,
  FaArrowUp // Import Up Arrow icon
} from 'react-icons/fa'; // Example icons from Font Awesome




interface ToolbarProps {
  selectedCount: number;
  isMoveActive: boolean;      // Is a move operation in progress?
  canPasteCopied: boolean;    // Are there items copied to the clipboard?
  onDeleteSelected: () => void;
  onDownloadZipSelected: () => void;
  onStartMove: () => void;      // Start the move process
  onConfirmMove: () => void;    // Confirm move to current location
  onCancelMove: () => void;     // Cancel the move process
  onCopySelected: () => void;
  onPasteCopied: () => void;    // Paste copied items
  // --- NEW Props ---
  onCreateFolder: () => void;
  onRenameStart: () => void; // Trigger rename mode
  // --- END NEW ---
  isZipping?: boolean;
  isLoading?: boolean;
  // --- NEW Navigation Props ---
  currentPath: string;
  onNavigateUp: () => void;
  // --- END NEW ---
}

const Toolbar: React.FC<ToolbarProps> = ({
  selectedCount,
  isMoveActive,
  canPasteCopied,
  onDeleteSelected,
  onDownloadZipSelected,
  onStartMove,
  onConfirmMove,
  onCancelMove,
  onCopySelected,
  onPasteCopied,
  // --- Destructure NEW ---
  onCreateFolder,
  onRenameStart,
  // --- END Destructure ---
  isZipping = false,
  isLoading = false,
  // --- Destructure NEW ---
  currentPath,
  onNavigateUp,
  // --- END NEW ---
}) => {
  const hasSelection = selectedCount > 0;
  const singleSelection = selectedCount === 1; // Needed for Rename
  const isRoot = currentPath === '';

  return (
    <div className={styles.toolbar}>
      {/* Section 1: Core Actions (New Folder, Up) */}
      <div className={styles.toolbarSectionLeft}>
        <button
          onClick={onCreateFolder}
          className={styles.toolbarIconButton}
          disabled={isLoading || isMoveActive} // Disable if loading or moving
          title="New Folder"
        >
          <FaFolderPlus />
        </button>
        {/* Up Button */}
        <button
          onClick={onNavigateUp}
          className={`${styles.toolbarIconButton} ${styles.toolbarUpButton}`}
          disabled={isLoading || isRoot} // Disable if loading or at root
          title="Go Up One Level"
        >
          <FaArrowUp />
        </button>
      </div>

      {/* Section 2: Current Path Display */}
      <div className={styles.toolbarSectionMiddle}>
         <span className={styles.toolbarPathDisplay} title={currentPath || 'Root'}>
           {currentPath || 'Root'}
         </span>
      </div>

      {/* Section 3: Contextual Actions (Selection, Move, Paste) */}
      <div className={styles.toolbarSectionRight}>
        {/* Selection-based actions */}
        {hasSelection && !isMoveActive && (
          <>
            <button
              onClick={onDeleteSelected}
              className={`${styles.toolbarIconButton} ${styles.dangerButton}`}
              disabled={isLoading}
              title="Delete Selected"
            >
              <FaTrashAlt />
            </button>
            <button
              onClick={onDownloadZipSelected}
              className={styles.toolbarIconButton}
              disabled={isZipping || isLoading}
              title="Download Selected as ZIP"
            >
              <FaDownload />
            </button>
            <button
              onClick={onStartMove}
              className={styles.toolbarIconButton}
              disabled={isLoading}
              title="Cut (Move)"
            >
              <FaCut />
            </button>
            <button
              onClick={onCopySelected}
              className={styles.toolbarIconButton}
              disabled={isLoading}
              title="Copy"
            >
              <FaCopy />
            </button>
            {singleSelection && (
              <button
                onClick={onRenameStart}
                className={styles.toolbarIconButton}
                disabled={isLoading}
                title="Rename"
              >
                <FaEdit />
              </button>
            )}
          </>
        )}

        {/* Paste Button (only for copied items) */}
        {canPasteCopied && !isMoveActive && (
          <button
            onClick={onPasteCopied}
            className={styles.toolbarIconButton}
            disabled={isLoading}
            title="Paste Copied Items"
          >
            <FaPaste />
          </button>
        )}

        {/* Move Active State */}
        {isMoveActive && (
          <>
            <span className={styles.moveActiveIndicator}>
              Move {selectedCount} item(s)... Choose destination and confirm.
            </span>
            <button
              onClick={onConfirmMove}
              className={`${styles.toolbarIconButton} ${styles.confirmButton}`}
              disabled={isLoading}
              title="Confirm Move Here"
            >
              <FaCheck />
            </button>
            <button
              onClick={onCancelMove}
              className={`${styles.toolbarIconButton} ${styles.cancelButton}`}
              disabled={isLoading}
              title="Cancel Move"
            >
              <FaTimes />
            </button>
          </>
        )}
        {/* Selection Count (always visible?) */}
        {!isMoveActive && (
           <span className={styles.selectionCount}>
             {selectedCount > 0 ? `${selectedCount} item(s) selected` : 'No items selected'}
           </span>
        )}
      </div>
    </div>
  );
};

export default Toolbar;
