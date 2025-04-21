import React, { useRef, useEffect } from 'react'; // Import useRef, useEffect
import type { BlobItem } from '../types';
import { getIconForFile } from '../utils/getIconForFile'; // Assuming you have this util
import styles from '../BasicFileSystem.module.css';
import { FaTrashAlt, FaDownload } from 'react-icons/fa'; // Import trash and download icons

interface FileListItemProps {
  item: BlobItem;
  isLoading: boolean;
  // onNavigate: (path: string) => void; // Keep if needed for future features
  onDelete: (path: string) => void;
  onItemDoubleClick: (item: BlobItem) => void;
  isSelected: boolean;
  // Modify onSelect to handle checkbox change
  onSelect: (itemPath: string, isSelected: boolean) => void;
  // --- NEW Drag/Drop Props ---
  isDragged: boolean;
  isDragOver: boolean;
  onDragStart: (event: React.DragEvent, itemPath: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent, targetPath: string) => void;
  onDragEnter: (event: React.DragEvent, targetPath: string) => void;
  onDragLeave: (event: React.DragEvent, targetPath: string) => void;
  onDrop: (event: React.DragEvent, targetFolderPath: string) => void;
  // --- NEW: Add prop for move styling ---
  isMarkedForMove: boolean;
  // --- END NEW ---
  // --- NEW Rename Props ---
  isRenaming: boolean;
  tempNewName: string;
  onTempNewNameChange: (newName: string) => void;
  onRenameConfirm: (originalPath: string, newName: string) => void;
  onRenameCancel: () => void;
  // --- END NEW ---
  // --- NEW Context Menu Prop ---
  onContextMenu: (event: React.MouseEvent, item: BlobItem) => void;
  // --- END NEW ---
  // --- NEW Download Prop ---
  onDownload: (item: BlobItem) => void;
  // --- END NEW ---
}

const FileListItem: React.FC<FileListItemProps> = ({
  item,
  isLoading,
  // onNavigate,
  onDelete,
  onItemDoubleClick,
  isSelected,
  onSelect,
  // --- Destructure new props ---
  isDragged,
  isDragOver,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  // --- Destructure new prop ---
  isMarkedForMove,
  // --- END Destructure ---
  isRenaming,
  tempNewName,
  onTempNewNameChange,
  onRenameConfirm,
  onRenameCancel,
  onContextMenu,
  // --- Destructure NEW ---
  onDownload,
  // --- END Destructure ---
}) => {
  const renameInputRef = useRef<HTMLInputElement>(null); // Ref for the input

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select(); // Select text
    }
  }, [isRenaming]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    // Prevent double-click action if renaming or loading
    if (isRenaming || isLoading) return;
    onItemDoubleClick(item);
  };

  // --- NEW: Handle checkbox change ---
  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Prevent selection change if renaming
    if (isRenaming) return;
    onSelect(item.path, event.target.checked);
  };
  // --- END NEW ---

  // --- Rename Input Handlers ---
  const handleRenameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTempNewNameChange(e.target.value);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent form submission if wrapped in form
      onRenameConfirm(item.path, tempNewName);
    } else if (e.key === 'Escape') {
      onRenameCancel();
    }
  };

  const handleRenameBlur = () => {
    // Optionally confirm on blur, or just cancel
    onRenameCancel(); // Cancel if input loses focus without Enter
  };
  // --- End Rename Input Handlers ---

  // --- Context Menu Handler ---
  const handleContextMenuInternal = (event: React.MouseEvent) => {
    // Prevent context menu during rename or loading
    if (isRenaming || isLoading) {
        event.preventDefault();
        return;
    }
    onContextMenu(event, item);
  };
  // --- End Context Menu ---

  // Combine classes conditionally
  const itemClasses = `
    ${styles.fileItem}
    ${isSelected ? styles.selected : ''} {/* Add selected class */}
    ${isDragged ? styles.dragging : ''}
    ${isDragOver ? styles.dragOver : ''}
    ${isMarkedForMove ? styles.markedForMove : ''} // Add class if marked for move
  `;

  // --- Drag Handlers ---
  const handleDragStartInternal = (event: React.DragEvent) => {
    // Don't allow dragging if loading or if clicking checkbox/button
    if (isLoading || (event.target as HTMLElement).closest(`.${styles.selectCheckbox}, .${styles.deleteButton}`)) {
        event.preventDefault();
        return;
    }
    onDragStart(event, item.path);
  };

  // --- Drop Handlers (only for folders) ---
  const handleDragOverInternal = (event: React.DragEvent) => {
    if (item.isDirectory) {
      onDragOver(event, item.path);
    }
  };
  const handleDragEnterInternal = (event: React.DragEvent) => {
    if (item.isDirectory) {
      onDragEnter(event, item.path);
    }
  };
  const handleDragLeaveInternal = (event: React.DragEvent) => {
    if (item.isDirectory) {
      onDragLeave(event, item.path);
    }
  };
  const handleDropInternal = (event: React.DragEvent) => {
    if (item.isDirectory) {
      onDrop(event, item.path);
    }
  };
  // --- End Drop Handlers ---

  // --- Format Date ---
  const formatDate = (date?: Date) => {
    return date ? new Date(date).toLocaleString() : ' '; // Return space or dash if no date
  };
  // --- End Format Date ---

  return (
    <li
      className={itemClasses}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenuInternal} // Attach context menu handler
      // --- Add Drag/Drop Handlers ---
      draggable={!isLoading && !isMarkedForMove && !isRenaming} // Prevent dragging items marked for move? Optional.
      onDragStart={handleDragStartInternal}
      onDragEnd={onDragEnd}
      // Add drop handlers only if it's a directory
      onDragOver={handleDragOverInternal}
      onDragEnter={handleDragEnterInternal}
      onDragLeave={handleDragLeaveInternal}
      onDrop={handleDropInternal}
      // --- End Add ---
    >
      {/* --- Add Checkbox --- */}
      <input
        type="checkbox"
        className={styles.selectCheckbox}
        checked={isSelected && !isRenaming} // Uncheck visually during rename
        onChange={handleCheckboxChange}
        onClick={(e) => e.stopPropagation()} // Prevent clicks bubbling to li's double-click
        disabled={isLoading || isRenaming} // Disable during rename
      />
      {/* --- End Checkbox --- */}

      <span className={styles.iconSpan}>{getIconForFile(item)}</span>

      {/* --- Conditional Rename Input --- */}
      {isRenaming ? (
        <input
          ref={renameInputRef}
          type="text"
          value={tempNewName}
          onChange={handleRenameInputChange}
          onKeyDown={handleRenameKeyDown}
          onBlur={handleRenameBlur}
          className={styles.renameInput}
          onClick={(e) => e.stopPropagation()} // Prevent li click events
          onDoubleClick={(e) => e.stopPropagation()} // Prevent li dblclick
        />
      ) : (
        <span
          className={`${item.isDirectory ? styles.directory : styles.file} ${styles.itemName}`}
        >
           {item.name}
        </span>
      )}
      {/* --- End Conditional Rename Input --- */}

      {/* Keep size */}
      <span className={styles.itemSize}>
        {!item.isDirectory && item.size ? `${(item.size / 1024).toFixed(1)} KB` : ''}
      </span>

      {/* --- Add Last Modified Date --- */}
      <span className={styles.itemModified}> {/* Ensure class matches header */}
        {formatDate(item.lastModified)}
      </span>
      {/* --- End Last Modified Date --- */}

      {/* --- Actions Column (Visible on Hover) --- */}
      <span className={styles.itemActions}> {/* Wrap button for alignment */}
        {/* Download Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload(item); // Call download handler
          }}
          className={`${styles.iconButton} ${styles.downloadButton}`} // Add specific class if needed
          disabled={isLoading || isRenaming}
          title={`Download ${item.name}`}
        >
          <FaDownload /> {/* Use Download Icon */}
        </button>

        {/* Delete Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.path);
          }}
          className={`${styles.iconButton} ${styles.deleteButton}`} // Use generic iconButton + specific deleteButton styles
          disabled={isLoading || isRenaming} // Disable during rename
          title={`Delete ${item.name}`} // Add title for clarity
        >
          <FaTrashAlt /> {/* Use Trash Icon */}
        </button>
      </span>
      {/* --- End Actions Column --- */}
    </li>
  );
};

export default FileListItem;
