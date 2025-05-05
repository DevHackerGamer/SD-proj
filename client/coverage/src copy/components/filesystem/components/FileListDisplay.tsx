import React, { useRef, useEffect } from 'react'; // Import useRef and useEffect
import type { BlobItem, SortKey, SortDirection } from '../types'; // Import types
import styles from '../BasicFileSystem.module.css'; // Assuming styles are imported from the parent's module
import { formatFileSize, formatDate } from '../utils/formatters'; // Go up two levels to src/utils
// --- Import Action Icons ---
import { FaDownload, FaTrashAlt } from 'react-icons/fa'; // Import required icons
// --- End Import ---
import { FileIcon, FolderIcon } from './Icons'; // Assuming Icons.tsx is in the same directory

interface FileListDisplayProps {
  items: BlobItem[];
  isLoading: boolean; // Add isLoading prop
  onDelete: (path: string) => void;
  onItemDoubleClick: (item: BlobItem) => void;
  selectedPaths: Set<string>;
  onItemSelect: (path: string, isSelected: boolean) => void;
  itemsToMovePathsSet: Set<string>; // Set for quick lookup
  renamingPath: string | null;
  tempNewName: string;
  onTempNewNameChange: (value: string) => void;
  onRenameConfirm: (originalPath: string, newName: string) => void;
  onRenameCancel: () => void;
  onContextMenu: (event: React.MouseEvent, item: BlobItem) => void;
  draggedItemPath: string | null;
  dragOverPath: string | null;
  onDragStart: (event: React.DragEvent, itemPath: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: React.DragEvent, targetPath: string) => void;
  onDragEnter: (event: React.DragEvent, targetPath: string) => void;
  onDragLeave: (event: React.DragEvent, targetPath: string) => void;
  onDrop: (event: React.DragEvent, targetFolderPath: string) => void;
  onSelectAll: (isChecked: boolean) => void; // Add select all handler prop
  sortKey: SortKey; // Add sort props
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  onDownload: (item: BlobItem) => void; // Add download handler prop
  highlightedPath?: string | null; // Make optional or required based on usage
}

const FileListDisplay: React.FC<FileListDisplayProps> = ({
  items,
  isLoading, // Use isLoading prop
  onDelete,
  onItemDoubleClick,
  selectedPaths,
  onItemSelect,
  itemsToMovePathsSet,
  renamingPath,
  tempNewName,
  onTempNewNameChange,
  onRenameConfirm,
  onRenameCancel,
  onContextMenu,
  draggedItemPath,
  dragOverPath,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onSelectAll, // Use select all handler
  sortKey, // Use sort props
  sortDirection,
  onSort,
  onDownload, // Use download handler
  highlightedPath,
}) => {
  // --- REMOVED: State for hover effect ---
  // const [isHoveringItem, setIsHoveringItem] = useState(false);
  // --- END REMOVED ---

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  // Calculate if all current items (excluding renaming) are selected
  const nonRenamingItems = items.filter(item => item.path !== renamingPath);
  const isAllSelected = nonRenamingItems.length > 0 && nonRenamingItems.every(item => selectedPaths.has(item.path));

  // --- Effect for highlighting and scrolling ---
  useEffect(() => {
    if (highlightedPath && items.some(item => item.path === highlightedPath)) {
      // Use a unique ID for each item row/element
      const element = document.getElementById(`file-item-${highlightedPath}`);
      if (element) {
        console.log(`[Highlight] Scrolling to and highlighting: ${highlightedPath}`);
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Add a temporary highlight class (define .highlighted in your CSS)
        element.classList.add(styles.highlighted);
        const timer = setTimeout(() => {
          element.classList.remove(styles.highlighted);
        }, 3000); // Duration of highlight

        // Cleanup function to remove class if component unmounts or highlight changes
        return () => {
          clearTimeout(timer);
          // Check if element still exists before removing class
          const currentElement = document.getElementById(`file-item-${highlightedPath}`);
          currentElement?.classList.remove(styles.highlighted);
        };
      } else {
        console.warn(`[Highlight] Element not found for path: ${highlightedPath}`);
      }
    }
  }, [highlightedPath, items]); // Re-run when highlightPath or items change
  // --- End Effect ---

  return (
    <div className={styles.fileListContainer}>
      {/* Header Row */}
      <div className={`${styles.fileItem} ${styles.fileListHeader}`}>
        <input
          type="checkbox"
          className={styles.itemCheckbox}
          checked={isAllSelected}
          onChange={(e) => onSelectAll(e.target.checked)}
          aria-label="Select all items"
        />
        <span className={styles.itemIcon}></span> {/* Placeholder for icon alignment */}
        <span className={styles.itemName} onClick={() => onSort('name')}>
          Name{getSortIndicator('name')}
        </span>
        {/* Ensure this span uses the correct class for alignment */}
        <span className={styles.headerItemSize} onClick={() => onSort('size')}>
          Size{getSortIndicator('size')}
        </span>
        <span className={styles.itemModified} onClick={() => onSort('lastModified')}>
          Date Modified{getSortIndicator('lastModified')}
        </span>
        {/* --- Remove conditional class from Actions header --- */}
        <span className={styles.itemActions}> {/* Removed conditional class logic */}
          Actions
        </span>
        {/* --- End Change --- */}
      </div>

      {/* File Items List */}
      {isLoading ? (
        <div className={styles.loading}>Loading...</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>Folder is empty.</div>
      ) : (
        items.map((item) => {
          const isSelected = selectedPaths.has(item.path);
          const isMarkedForMove = itemsToMovePathsSet.has(item.path);
          const isRenamingThis = renamingPath === item.path;
          const isDraggingThis = draggedItemPath === item.path;
          const isDragOverTarget = dragOverPath === item.path && item.isDirectory && !isDraggingThis;

          return (
            <div
              key={item.path}
              id={`file-item-${item.path}`} // Add unique ID for scrolling/highlighting
              className={`
                ${styles.fileItem}
                ${isSelected ? styles.selected : ''}
                ${isMarkedForMove ? styles.markedForMove : ''}
                ${isDraggingThis ? styles.dragging : ''}
                ${isDragOverTarget ? styles.dragOver : ''}
              `}
              onDoubleClick={() => !isRenamingThis && onItemDoubleClick(item)}
              onContextMenu={(e) => !isRenamingThis && onContextMenu(e, item)}
              draggable={!isRenamingThis} // Make items draggable
              onDragStart={(e) => !isRenamingThis && onDragStart(e, item.path)}
              onDragEnd={onDragEnd}
              // Drag events for potential drop targets (folders)
              onDragOver={(e) => item.isDirectory && onDragOver(e, item.path)}
              onDragEnter={(e) => item.isDirectory && onDragEnter(e, item.path)}
              onDragLeave={(e) => item.isDirectory && onDragLeave(e, item.path)}
              onDrop={(e) => item.isDirectory && onDrop(e, item.path)}
              // --- REMOVED Hover Handlers ---
              // onMouseEnter={() => setIsHoveringItem(true)}
              // onMouseLeave={() => setIsHoveringItem(false)}
              // --- END REMOVED ---
            >
              <input
                type="checkbox"
                className={styles.itemCheckbox}
                checked={isSelected}
                onChange={(e) => onItemSelect(item.path, e.target.checked)}
                disabled={isRenamingThis} // Disable checkbox when renaming
              />
              <span className={styles.itemIcon}>
                {item.isDirectory ? <FolderIcon /> : <FileIcon contentType={item.contentType} />}
              </span>
              <span className={styles.itemName}>
                {isRenamingThis ? (
                  <input
                    type="text"
                    value={tempNewName}
                    onChange={(e) => onTempNewNameChange(e.target.value)}
                    onBlur={() => onRenameConfirm(item.path, tempNewName)} // Confirm on blur
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onRenameConfirm(item.path, tempNewName);
                      if (e.key === 'Escape') onRenameCancel();
                    }}
                    autoFocus // Focus the input when renaming starts
                    className={styles.renameInput}
                  />
                ) : (
                  item.name
                )}
              </span>
              {/* Ensure this span uses the correct class for alignment */}
              <span className={styles.itemSize}>
                {!item.isDirectory ? formatFileSize(item.size) : '--'}
              </span>
              <span className={styles.itemModified}>
                {formatDate(item.lastModified)}
              </span>
              <span className={styles.itemActions}>
                {!isRenamingThis && ( // Hide actions when renaming
                  <>
                    {/* --- Use Icons instead of Emojis --- */}
                    <button onClick={() => onDownload(item)} title="Download" className={styles.actionButton}>
                      <FaDownload /> {/* Use Download Icon */}
                    </button>
                    <button onClick={() => onDelete(item.path)} title="Delete" className={styles.actionButton}>
                      <FaTrashAlt /> {/* Use Delete Icon */}
                    </button>
                    {/* --- End Icon Usage --- */}
                  </>
                )}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
};

export default FileListDisplay;
