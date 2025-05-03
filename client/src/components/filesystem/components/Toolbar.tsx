import React, { useState, useEffect, useRef } from 'react';
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
  FaArrowUp,
  FaHome,
  FaChevronRight,
  FaInfoCircle,
  FaEllipsisH,
  FaChevronLeft  // For scroll left
  // Removed duplicate FaChevronRight import
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
  onCreateFolder: (folderName: string) => void; // Update prop to accept folder name
  onRenameStart: () => void; // Trigger rename mode
  onEditMetadata?: () => void; // Add new prop for Edit Metadata
  isSelectedItemDirectory?: boolean; // Add prop to check if selected item is a directory
  isZipping?: boolean;
  isLoading?: boolean;
  currentPath: string;
  onNavigateUp: () => void;
  onNavigateToPath: (path: string) => void;
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
  onCreateFolder,
  onRenameStart,
  onEditMetadata,
  isSelectedItemDirectory = false,
  isZipping = false,
  isLoading = false,
  currentPath,
  onNavigateUp,
  onNavigateToPath,
}) => {
  const hasSelection = selectedCount > 0;
  const singleSelection = selectedCount === 1; // Needed for Rename and Edit Metadata
  const isRoot = currentPath === '';

  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [expandedBreadcrumbs, setExpandedBreadcrumbs] = useState<boolean>(false);
  const [hasOverflow, setHasOverflow] = useState<boolean>(false);
  const breadcrumbRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced scroll behavior with auto-scrolling when hovering on breadcrumb items
  const [autoScrollActive, setAutoScrollActive] = useState<boolean>(false);
  const autoScrollDirection = useRef<'left' | 'right' | null>(null);
  const breadcrumbItemsRef = useRef<HTMLDivElement>(null);

  // Add state for folder creation modal
  const [showFolderModal, setShowFolderModal] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [folderError, setFolderError] = useState<string>('');

  // Check for overflow on mount and path change
  useEffect(() => {
    const container = breadcrumbRef.current;
    if (!container) return;

    // Check if breadcrumb content overflows container
    const checkOverflow = () => {
      if (container) {
        const hasHorizontalOverflow = container.scrollWidth > container.clientWidth;
        setHasOverflow(hasHorizontalOverflow);
        
        console.log(`[Breadcrumb] Overflow check: ${hasHorizontalOverflow ? 'Has overflow' : 'No overflow'}`);
        console.log(`[Breadcrumb] scrollWidth: ${container.scrollWidth}, clientWidth: ${container.clientWidth}`);
      }
    };

    // Wait for render to complete
    setTimeout(checkOverflow, 100);

    // Add resize listener
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [currentPath, expandedBreadcrumbs]);

  // Focus active breadcrumb on path change
  useEffect(() => {
    // Wait for render to complete
    setTimeout(() => {
      const container = breadcrumbRef.current;
      if (!container) return;
      
      // Find the active breadcrumb
      const activeItem = container.querySelector(`.${styles.activeBreadcrumb}`);
      if (activeItem) {
        // Scroll to make active item visible
        activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        console.log('[Breadcrumb] Scrolled to active item');
      }
    }, 100);
  }, [currentPath]);

  // Start scrolling when hovering scroll triggers - use consistent high speed
  const startScroll = (direction: 'left' | 'right') => {
    const container = breadcrumbRef.current;
    if (!container) return;

    // Clear any existing interval
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    // Consistent high scroll speed (pixels per frame)
    const SCROLL_SPEED = 15;

    // Set up interval to scroll continuously while hovering
    scrollIntervalRef.current = setInterval(() => {
      if (direction === 'left') {
        container.scrollLeft -= SCROLL_SPEED;
      } else {
        container.scrollLeft += SCROLL_SPEED;
      }
    }, 16); // ~60fps
    
    console.log(`[Breadcrumb] Started ${direction} scrolling at speed ${SCROLL_SPEED}`);
  };

  // Stop scrolling when leaving scroll triggers
  const stopScroll = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
      console.log('[Breadcrumb] Stopped scrolling');
    }
  };

  // Handle navigation with debugging
  const handleBreadcrumbClick = (path: string, e?: React.MouseEvent) => {
    // Prevent default browser behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log(`[Breadcrumb] Clicked path: "${path}", expanded=${expandedBreadcrumbs}`);
    
    // Ensure the click registers regardless of expansion state
    if (typeof onNavigateToPath === 'function') {
      // Use setTimeout to escape any current event processing
      setTimeout(() => {
        console.log(`[Breadcrumb] Navigating to: "${path}" (using setTimeout)`);
        onNavigateToPath(path);

        // After navigation, collapse the breadcrumb if it was expanded
        if (expandedBreadcrumbs) {
          console.log('[Breadcrumb] Auto-collapsing after navigation');
          setExpandedBreadcrumbs(false);
          
          // Also hide dropdown if it was visible
          if (dropdownVisible) {
            setDropdownVisible(false);
          }
        }
      }, 0);
    } else {
      console.error('[Breadcrumb] onNavigateToPath is not a function!', onNavigateToPath);
    }
  };

  // Toggle expanded breadcrumbs view while preserving click handlers
  const toggleExpandedBreadcrumbs = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newState = !expandedBreadcrumbs;
    console.log(`[Breadcrumb] Setting expandedBreadcrumbs to: ${newState}`);
    
    // Set state with functional update to ensure latest value
    setExpandedBreadcrumbs(newState);
    
    // Update CSS class for expanded state
    const container = breadcrumbRef.current;
    if (container) {
      if (newState) {
        container.classList.add(styles.expanded);
      } else {
        container.classList.remove(styles.expanded);
      }
      
      // After toggling, check for overflow again
      setTimeout(() => {
        if (container) {
          const hasHorizontalOverflow = container.scrollWidth > container.clientWidth;
          setHasOverflow(hasHorizontalOverflow);
          console.log(`[Breadcrumb] After toggle, overflow: ${hasHorizontalOverflow}`);
        }
      }, 50);
    }
  };

  // Generate breadcrumb navigation with ensured click handling for expanded view
  const renderBreadcrumbs = () => {
    const segments = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [];
    
    // Always show root
    breadcrumbs.push(
      <button 
        key="root" 
        className={`${styles.breadcrumbItem} ${isRoot ? styles.activeBreadcrumb : ''}`}
        onClick={(e) => handleBreadcrumbClick('', e)}
        type="button"
        disabled={isRoot} // Only disabled when at root
      >
        <FaHome /> Root
      </button>
    );

    // If no segments, we're at root, so just return
    if (segments.length === 0) {
      return breadcrumbs;
    }
    
    // Add first separator with unique key
    breadcrumbs.push(
      <span key="root-separator" className={styles.breadcrumbSeparator}>
        <FaChevronRight />
      </span>
    );
    
    // If we have more than 7 segments (3 + ... + 3), use ellipsis for the middle
    const MIN_SEGMENTS_PER_SIDE = 3;
    const MINIMUM_FOR_COLLAPSE = (MIN_SEGMENTS_PER_SIDE * 2) + 1; // 3 before + 3 after + ellipsis
    
    if (segments.length > MINIMUM_FOR_COLLAPSE && !expandedBreadcrumbs) {
      // Render first 3 segments
      let currentPath = "";
      
      for (let i = 0; i < MIN_SEGMENTS_PER_SIDE && i < segments.length; i++) {
        const segment = segments[i];
        
        // Build path
        if (currentPath) {
          currentPath += '/' + segment;
        } else {
          currentPath = segment;
        }
        
        // Add segment button
        breadcrumbs.push(
          <button 
            key={`start-${currentPath}`} 
            className={styles.breadcrumbItem}
            onClick={(e) => handleBreadcrumbClick(currentPath, e)}
            type="button"
          >
            {segment}
          </button>
        );
        
        // Add separator if not the last in this section
        if (i < MIN_SEGMENTS_PER_SIDE - 1 && i < segments.length - 1) {
          breadcrumbs.push(
            <span key={`separator-start-${i}`} className={styles.breadcrumbSeparator}>
              <FaChevronRight />
            </span>
          );
        }
      }
      
      // Add ellipsis button - clicking toggles expanded view
      breadcrumbs.push(
        <button
          key="ellipsis"
          className={styles.collapsedSegment}
          onClick={toggleExpandedBreadcrumbs}
          type="button"
          title="Show all path segments"
        >
          <FaEllipsisH />
        </button>
      );
      
      // Render last 3 segments
      const startIdx = Math.max(MIN_SEGMENTS_PER_SIDE, segments.length - MIN_SEGMENTS_PER_SIDE);
      
      // Build the path prefix for the last segments
      let pathPrefix = segments.slice(0, startIdx).join('/');
      
      for (let i = startIdx; i < segments.length; i++) {
        // Add separator before the segment (with unique key)
        breadcrumbs.push(
          <span key={`separator-end-${i}`} className={styles.breadcrumbSeparator}>
            <FaChevronRight />
          </span>
        );
        
        const segment = segments[i];
        const fullPath = pathPrefix ? `${pathPrefix}/${segment}` : segment;
        
        // Update pathPrefix for next iteration
        pathPrefix = fullPath;
        
        const isLast = i === segments.length - 1;
        
        // Add segment button
        breadcrumbs.push(
          <button 
            key={`end-${fullPath}`} 
            className={`${styles.breadcrumbItem} ${isLast ? styles.activeBreadcrumb : ''}`}
            onClick={(e) => handleBreadcrumbClick(fullPath, e)}
            type="button"
            disabled={isLast} // ONLY disable the last (current) directory
          >
            {segment}
          </button>
        );
      }
      
      // Add dropdown for all segments (only shown on click of ellipsis)
      breadcrumbs.push(
        <div 
          key="dropdown" 
          className={`${styles.breadcrumbDropdown} ${styles.hasHiddenSegments}`}
          style={{ display: dropdownVisible ? 'block' : 'none' }}
        >
          <div 
            className={styles.breadcrumbDropdownItem} 
            onClick={(e) => {
              handleBreadcrumbClick('', e);
              setDropdownVisible(false);
            }}
          >
            <FaHome /> Root
          </div>
          
          {segments.map((segment, index) => {
            // Build the full path to this segment
            const segmentPath = segments.slice(0, index + 1).join('/');
            const isActive = index === segments.length - 1;
            
            return (
              <div
                key={`dropdown-${segmentPath}`}
                className={`${styles.breadcrumbDropdownItem} ${isActive ? styles.active : ''}`}
                onClick={(e) => {
                  handleBreadcrumbClick(segmentPath, e);
                  setDropdownVisible(false);
                }}
              >
                {segment}
              </div>
            );
          })}
        </div>
      );
    } else {
      // Regular rendering for fewer segments or when expanded
      let currentSegmentPath = '';
      
      segments.forEach((segment, index) => {
        const isLast = index === segments.length - 1;
        
        // Build path
        if (currentSegmentPath) {
          currentSegmentPath += '/' + segment;
        } else {
          currentSegmentPath = segment;
        }
        
        // Create the path for logging and debugging
        const fullPath = currentSegmentPath;
        
        // Add segment button with direct click handler - no event delegation
        breadcrumbs.push(
          <button 
            key={`full-${fullPath}`} 
            className={`${styles.breadcrumbItem} ${isLast ? styles.activeBreadcrumb : ''}`}
            onClick={(e) => {
              // Force stopPropagation to prevent bubbling
              e.stopPropagation();
              // Log the click with more details
              console.log(`[Breadcrumb] Direct click on: "${fullPath}", expanded=${expandedBreadcrumbs}`);
              // Navigate directly without delay in this case
              if (!isLast) onNavigateToPath(fullPath);
            }}
            type="button"
            disabled={isLast} // ONLY disable the last (current) directory
            data-path={fullPath} // Add data attribute for debugging
          >
            {segment}
          </button>
        );
        
        // Add separator if not the last segment (with unique key)
        if (!isLast) {
          breadcrumbs.push(
            <span key={`separator-full-${index}`} className={styles.breadcrumbSeparator}>
              <FaChevronRight />
            </span>
          );
        }
      });
      
      // Add collapse button if expanded
      if (expandedBreadcrumbs && segments.length > MINIMUM_FOR_COLLAPSE) {
        breadcrumbs.push(
          <button
            key="collapse"
            className={`${styles.collapsedSegment} ${styles.collapseButton}`}
            onClick={toggleExpandedBreadcrumbs}
            type="button"
            title="Collapse path display"
          >
            <FaTimes />
          </button>
        );
      }
    }
    
    return breadcrumbs;
  };

  // Clean up any interval on unmount
  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  // Check if we need auto-scrolling based on container position
  const checkAutoScroll = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = breadcrumbRef.current;
    if (!container) return;

    // Get container dimensions and position
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX;
    
    // Define auto-scroll zones (20% of container width on each end)
    const leftZone = rect.left + rect.width * 0.2;
    const rightZone = rect.right - rect.width * 0.2;
    
    // Determine if we should auto-scroll based on mouse position
    if (mouseX < leftZone && container.scrollLeft > 0) {
      autoScrollDirection.current = 'left';
      if (!autoScrollActive) {
        setAutoScrollActive(true);
        startAutoScroll();
      }
    } else if (mouseX > rightZone && container.scrollLeft < container.scrollWidth - container.clientWidth) {
      autoScrollDirection.current = 'right';
      if (!autoScrollActive) {
        setAutoScrollActive(true);
        startAutoScroll();
      }
    } else {
      autoScrollDirection.current = null;
      if (autoScrollActive) {
        setAutoScrollActive(false);
      }
    }
  };

  // Auto-scroll function with consistent speed
  const startAutoScroll = () => {
    const container = breadcrumbRef.current;
    if (!container || !autoScrollDirection.current || scrollIntervalRef.current) return;

    // Use the same scroll speed as manual scrolling for consistency
    const SCROLL_SPEED = 15;

    // Set up interval to scroll continuously while in auto-scroll zone
    scrollIntervalRef.current = setInterval(() => {
      if (!container || !autoScrollDirection.current) return;
      
      if (autoScrollDirection.current === 'left') {
        container.scrollLeft -= SCROLL_SPEED;
      } else {
        container.scrollLeft += SCROLL_SPEED;
      }
      
      // Check if we've reached the end of scrolling
      if ((autoScrollDirection.current === 'left' && container.scrollLeft <= 0) ||
          (autoScrollDirection.current === 'right' && 
           container.scrollLeft >= container.scrollWidth - container.clientWidth)) {
        stopScroll();
        setAutoScrollActive(false);
      }
    }, 16); // ~60fps
  };

  // Stop auto-scrolling
  const stopAutoScroll = () => {
    setAutoScrollActive(false);
    stopScroll();
  };

  // Handle creating folder via modal instead of prompt
  const handleCreateFolderClick = () => {
    setNewFolderName('');
    setFolderError('');
    setShowFolderModal(true);
  };

  // Handle folder creation form submission
  const handleFolderSubmit = () => {
    // Validate folder name
    if (!newFolderName.trim()) {
      setFolderError('Folder name cannot be empty');
      return;
    }
    
    if (newFolderName.includes('/') || newFolderName.includes('\\')) {
      setFolderError('Folder name cannot contain slashes');
      return;
    }
    
    // Close modal and create folder
    setShowFolderModal(false);
    onCreateFolder(newFolderName); // Pass the folder name to the handler
  };

  return (
    <div className={styles.toolbar}>
      {/* Section 1: Core Actions (New Folder, Up) */}
      <div className={styles.toolbarSectionLeft}>
        <button
          onClick={handleCreateFolderClick} // Use the new handler
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

      {/* Section 2: Current Path Display with Enhanced Breadcrumbs */}
      <div className={styles.toolbarSectionMiddle}>
        <div 
          className={`${styles.breadcrumbContainer} ${hasOverflow ? styles.hasOverflow : ''} ${expandedBreadcrumbs ? styles.expanded : ''}`}
          ref={breadcrumbRef}
          onMouseMove={checkAutoScroll}
          onMouseLeave={stopAutoScroll}
          // Add debugging click handler to container
          onClick={(e) => {
            console.log('[Breadcrumb] Container clicked');
          }}
        >
          {/* Left scroll trigger - without icon to avoid overlap */}
          <div 
            className={styles.scrollTriggerLeft}
            onMouseEnter={() => startScroll('left')}
            onMouseLeave={stopScroll}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Removed visual icon */}
          </div>
          
          {/* Breadcrumb content wrapper */}
          <div 
            ref={breadcrumbItemsRef} 
            className={styles.breadcrumbItems}
            // Add debugging click handler to items container
            onClick={(e) => {
              console.log('[Breadcrumb] Items container clicked');
            }}
          >
            {renderBreadcrumbs()}
          </div>
          
          {/* Right scroll trigger - without icon to avoid overlap */}
          <div 
            className={styles.scrollTriggerRight}
            onMouseEnter={() => startScroll('right')}
            onMouseLeave={stopScroll}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Removed visual icon */}
          </div>
        </div>
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
            {/* Only show Rename and Edit Metadata buttons for single selections */}
            {singleSelection && (
              <>
                <button
                  onClick={onRenameStart}
                  className={styles.toolbarIconButton}
                  disabled={isLoading}
                  title="Rename"
                >
                  <FaEdit />
                </button>
                {/* Add Edit Metadata button - only for files */}
                {!isSelectedItemDirectory && onEditMetadata && (
                  <button
                    onClick={onEditMetadata}
                    className={`${styles.toolbarIconButton} ${styles.editButton}`}
                    disabled={isLoading}
                    title="Edit Metadata"
                  >
                    <FaInfoCircle />
                  </button>
                )}
              </>
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

      {/* Add New Folder Modal */}
      {showFolderModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent + ' ' + styles.folderModal}>
            <button 
              className={styles.modalCloseButton} 
              onClick={() => setShowFolderModal(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h3>Create New Folder</h3>
            <div className={styles.formGroup}>
              <label htmlFor="folderName">Folder Name:</label>
              <input
                id="folderName"
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                autoFocus
                className={styles.folderNameInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFolderSubmit();
                  if (e.key === 'Escape') setShowFolderModal(false);
                }}
              />
              {folderError && <div className={styles.error}>{folderError}</div>}
              <div className={styles.folderPathPreview}>
                Will be created in: <span>{currentPath || 'Root'}</span>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => setShowFolderModal(false)}
              >
                Cancel
              </button>
              <button 
                className={styles.confirmButton}
                onClick={handleFolderSubmit}
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
