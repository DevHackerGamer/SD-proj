import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fileSystemService } from './FileSystemService';
import { SearchBar } from '../SearvhBar/SearchBar';
// Import SortKey and SortDirection from types.ts
// --- Add FileMetadata type import ---
import type { BlobItem, BlobItemProperties, SortKey, SortDirection, FileMetadata } from './types';
// --- End Add ---
import styles from './BasicFileSystem.module.css';

import UploadSection from './components/UploadSection';
import FileListDisplay from './components/FileListDisplay';
import StatusDisplay from './components/StatusDisplay';
import FilePreviewModal from './components/FilePreviewModal';
import Toolbar from './components/Toolbar';
import PropertiesModal from './components/PropertiesModal'; // Import PropertiesModal
// --- Import MetadataModal ---
import MetadataModal from './components/MetadataModal';
// --- End Import ---
import path from 'path-browserify';
import { Menu, Item, useContextMenu } from 'react-contexify';
import 'react-contexify/dist/ReactContexify.css';
import { ToastContainer, toast } from 'react-toastify'; // Import toast
import 'react-toastify/dist/ReactToastify.css'; // Import toast styles
// --- Import Parser ---
import { parseBlobMetadataToFileMetadata } from './utils/metadataParser';
// --- End Import ---
import { FileSystemService } from './FileSystemService';
import type { Node } from './types';

const MENU_ID = "file-item-menu";

interface File {
  path: string;
  type: 'file' | 'folder';
  metadata: Record<string, string>;
}

// Ensure the component definition is correct
const BasicFileSystem: React.FC = () => {
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [query, setQuery] = useState<string>('');
  const [items, setItems] = useState<BlobItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null); // Keep for status bar if needed, but use toast for popups
  const [currentPath, setCurrentPath] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<BlobItem | null>(null); // State for preview modal
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set()); // State for selected items
  const [isZipping, setIsZipping] = useState<boolean>(false); // Add loading state for zipping
  // --- NEW: Metadata Modal State ---
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState<boolean>(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  // --- END NEW ---
  // --- NEW: Drag and Drop State ---
  const [draggedItemPath, setDraggedItemPath] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null); // Track potential drop target
  // --- END NEW ---
  // --- State for Move Operation ---
  const [isMoveActive, setIsMoveActive] = useState<boolean>(false);
  const [itemsToMovePaths, setItemsToMovePaths] = useState<string[]>([]);
  const [copiedItemPaths, setCopiedItemPaths] = useState<string[]>([]);
  // --- NEW State ---
  const [renamingPath, setRenamingPath] = useState<string | null>(null); // Path of item being renamed
  const [tempNewName, setTempNewName] = useState<string>(''); // Temp input value for rename
  // --- END NEW ---
  // --- NEW Properties State ---
  const [propertiesItem, setPropertiesItem] = useState<BlobItemProperties | null>(null);
  const [isPropertiesLoading, setIsPropertiesLoading] = useState<boolean>(false);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  // --- END NEW ---
  // --- NEW Sort State ---
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // --- END NEW ---
  // --- NEW: State for highlighting uploaded file ---
  const [highlightedPath, setHighlightedPath] = useState<string | null>(null);
  // --- END NEW ---
  // --- NEW: State for editing metadata ---
  const [editingMetadataItem, setEditingMetadataItem] = useState<{ path: string; name: string; metadata: FileMetadata } | null>(null);
  // --- END NEW ---

  // --- Context Menu Hook ---
  const { show } = useContextMenu({ id: MENU_ID });
  // --- End Context Menu ---

  // --- Helper to show notifications ---
  const notifySuccess = (message: string) => toast.success(message);
  const notifyError = (message: string) => toast.error(message);
  const notifyInfo = (message: string) => toast.info(message);
  // --- End Helper ---

  const loadItems = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null); // Clear status bar error
    console.log(`Loading items for path: "${path}"`);
    try {
      const fetchedItems = await fileSystemService.listFiles(path);
      // --- Add validation for fetched items (if needed, based on previous errors) ---
      // const validItems = fetchedItems.filter(item => /* validation logic */);
      // setItems(validItems);
      // --- If listFiles is confirmed to return valid BlobItem[], use directly: ---
      setItems(fetchedItems);
    } catch (err: any) {
      console.error('Failed to load items:', err);
      const message = err instanceof Error ? err.message : String(err);
      setError(message); // Set status bar error
      notifyError(`Load failed: ${message}`); // Show toast error
      // --- Clear items on load error to prevent processing invalid data ---
      setItems([]);
      // --- End Clear ---
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems(currentPath);
  }, [currentPath, loadItems]);

  // --- Replace handleFileUpload with handleFileUploadTrigger ---
  const handleFileUploadTrigger = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log(`File selected: ${file.name}. Opening metadata modal.`);
    setFileToUpload(file);
    setIsMetadataModalOpen(true);

    // Clear the input value so the same file can be selected again if needed
    event.target.value = '';
  };
  // --- End Replace ---

  // --- Restore handleUploadWithMetadata ---
  // NOTE: This function now handles both initial uploads and metadata updates (by re-uploading)
  const handleUploadWithMetadata = async (file: File | null, metadata: FileMetadata, targetPath: string) => {
      // If file is null, it means we are updating metadata for an existing file
      // We still need a File object to pass to the service, even if backend ignores it for updates
      // A better approach would be a dedicated backend updateMetadata endpoint
      const fileToUploadForService = file ?? new File([""], targetPath, { type: 'text/plain' }); // Create dummy file if needed

      if (!fileToUploadForService) return; // Should not happen with dummy file

      setUploading(true);
      setError(null);
      setHighlightedPath(null);
      console.log(`Uploading/Updating metadata for: ${targetPath}`);
      try {
          // Service expects File, Metadata, Path
          const result = await fileSystemService.uploadFile(fileToUploadForService, metadata, targetPath);

          if (!result || typeof result.filePath !== 'string') {
              console.error('[Upload/Update] Invalid response from service:', result);
              throw new Error('Operation completed, but received an invalid response from the server.');
          }

          notifySuccess(`Metadata updated successfully for "${path.basename(result.filePath)}".`);

          // --- Focus/Highlight Logic (same as before) ---
          const targetDirectory = path.dirname(result.filePath);
          const navigateAndHighlight = async () => {
              await new Promise(resolve => setTimeout(resolve, 100));
              setHighlightedPath(result.filePath);
              setTimeout(() => setHighlightedPath(null), 3000);
          };

          if (targetDirectory === '.' || targetDirectory === currentPath) {
              await loadItems(currentPath); // Refresh current view
              console.log(`Refreshed current directory: ${currentPath}`);
              await navigateAndHighlight();
          } else {
              // This case shouldn't happen for metadata edits, but keep for safety
              setCurrentPath(targetDirectory);
              console.log(`Navigated to target directory: ${targetDirectory}`);
              await navigateAndHighlight();
          }
          // --- End Focus/Highlight ---

      } catch (err: any) {
          console.error('Metadata update failed:', err);
          const message = err instanceof Error ? err.message : String(err);
          notifyError(`Metadata update failed: ${message}`);
          throw err; // Re-throw for modal
      } finally {
          setUploading(false);
          // Clear editing state regardless of success/fail when modal closes
          setEditingMetadataItem(null);
          setFileToUpload(null);
          setIsMetadataModalOpen(false);
      }
  };
  // --- End Restore ---


  // --- Modified handleDelete for single item (keep for individual delete buttons) ---
  const handleDeleteSingle = async (itemPath: string) => {
    // Use confirm for deletion, but toast for results
    if (!window.confirm(`Delete "${itemPath}"? This cannot be undone.`)) return;
    setError(null);
    console.log(`Deleting single item: ${itemPath}`);
    try {
      await fileSystemService.deleteItem(itemPath);
      notifySuccess(`Deleted "${path.basename(itemPath)}".`); // Success toast
      setSelectedPaths(prev => { // Remove from selection if deleted
        const next = new Set(prev);
        next.delete(itemPath);
        return next;
      });
      await loadItems(currentPath);
    } catch (err: any) {
      console.error('Single delete failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      // setError(message);
      notifyError(`Delete failed: ${message}`); // Toast error
    }
  };

  const navigateTo = (path: string) => {
    setCurrentPath(path);
  };

  const navigateUp = () => {
    if (!currentPath) return; 
    const parts = currentPath.split('/');
    parts.pop(); 
    navigateTo(parts.join('/'));
  };

  // --- Modified handleItemSelect for checkbox ---
  const handleItemSelect = (itemPath: string, isSelected: boolean) => {
    // --- Cancel Move if a marked item is deselected ---
    if (isMoveActive && !isSelected && itemsToMovePaths.includes(itemPath)) {
      console.log('[Select] Deselected item marked for move. Cancelling move.');
      handleCancelMove(); // Cancel the whole move operation
      // Also clear the current selection change attempt
      setSelectedPaths(prevSelected => new Set(prevSelected)); // Keep selection as is before this click
      return; // Stop further processing of this selection change
    }
    // --- End Cancel Move ---

    setSelectedPaths(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (isSelected) {
        newSelected.add(itemPath);
        console.log('[handleItemSelect] Selected:', itemPath);
      } else {
        newSelected.delete(itemPath);
        console.log('[handleItemSelect] Deselected:', itemPath);
      }
      return newSelected;
    });
  };
  // --- END Modified handleItemSelect ---

  // --- NEW: Select All Handler ---
  const handleSelectAll = (isChecked: boolean) => {
    if (isChecked) {
      // Select all non-renaming items
      const allPaths = new Set(sortedItems.filter(item => item.path !== renamingPath).map(item => item.path));
      setSelectedPaths(allPaths);
      console.log('[SelectAll] Selected all visible items.');
    } else {
      setSelectedPaths(new Set());
      console.log('[SelectAll] Deselected all items.');
    }
  };
  // --- END NEW ---

  // Clear selection when navigating
  useEffect(() => {
    setSelectedPaths(new Set());
  }, [currentPath]);

  // --- NEW: Handle double-click ---
  const handleItemDoubleClick = (item: BlobItem) => {
    if (item.isDirectory) {
      navigateTo(item.path);
    } else {
      console.log("Opening preview for:", item.name);
      setPreviewItem(item); // Set the item to preview, opening the modal
    }
  };

  // --- NEW: Close modal ---
  const handleCloseModal = () => {
    setPreviewItem(null); // Clear the preview item to close the modal
  };

  // --- NEW: Toolbar Action Handlers ---
  const handleDeleteSelected = async () => {
    if (selectedPaths.size === 0) return;
    if (!window.confirm(`Delete ${selectedPaths.size} selected item(s)? This cannot be undone.`)) return;

    setError(null);
    console.log('Deleting selected items:', Array.from(selectedPaths));
    setIsLoading(true);
    let successCount = 0;
    let errorMessages: string[] = [];

    for (const itemPath of selectedPaths) {
      try {
        await fileSystemService.deleteItem(itemPath);
        successCount++;
      } catch (err: any) {
        console.error(`Failed to delete ${itemPath}:`, err);
        const message = err instanceof Error ? err.message : String(err);
        errorMessages.push(`Failed to delete ${path.basename(itemPath)}: ${message}`);
      }
    }
    setSelectedPaths(new Set());
    await loadItems(currentPath);
    setIsLoading(false);

    if (errorMessages.length > 0) {
      notifyError(`Deleted ${successCount} item(s) with ${errorMessages.length} error(s). See console for details.`);
      // Optionally show first error: notifyError(errorMessages[0]);
    } else if (successCount > 0) {
      notifySuccess(`Successfully deleted ${successCount} item(s).`);
    }
  };

  const handleDownloadZipSelected = async () => {
    if (selectedPaths.size === 0 || isZipping) return; // Prevent multiple clicks

    console.log('Downloading selected items as ZIP:', Array.from(selectedPaths));
    setIsZipping(true);
    setError(null); // Clear previous errors
    try {
      // Call the service method
      await fileSystemService.downloadZip(Array.from(selectedPaths));
      // Success is implicit via browser download prompt
    } catch (err: any) {
      console.error('ZIP Download failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      notifyError(`ZIP Download failed: ${message}`); // Toast error
    } finally {
      setIsZipping(false);
    }
  };
  // --- END Toolbar Action Handlers ---

  // --- NEW Move Handlers ---
  const handleStartMove = () => {
    if (selectedPaths.size === 0) return;
    console.log('[Move] Starting move for items:', Array.from(selectedPaths));
    setItemsToMovePaths(Array.from(selectedPaths)); // Store paths to be moved
    setIsMoveActive(true); // Activate move mode
    setCopiedItemPaths([]); // Clear any copied items
    // Keep items selected for visual feedback
  };

  const handleConfirmMove = async () => {
    if (itemsToMovePaths.length === 0 || !isMoveActive) return;

    const destinationFolderPath = currentPath;
    console.log(`[Move] Confirming move of ${itemsToMovePaths.length} items to "${destinationFolderPath}"`);

    // Prevent moving into own subfolder (simple check)
    for (const sourcePath of itemsToMovePaths) {
        if (destinationFolderPath.startsWith(sourcePath + '/')) {
            notifyError(`Cannot move a folder into its own subfolder.`);
            return;
        }
        // Prevent moving item into the same location
        if (path.dirname(sourcePath) === destinationFolderPath) {
             notifyError(`Item(s) already in this location.`);
             // Optionally cancel the move here
             // handleCancelMove();
             return;
        }
    }

    setIsLoading(true);
    setError(null);
    try {
      await fileSystemService.moveItems(itemsToMovePaths, destinationFolderPath);
      notifySuccess(`Moved ${itemsToMovePaths.length} item(s).`); // Success toast
      // Clear move state on success
      setItemsToMovePaths([]);
      setIsMoveActive(false);
      setSelectedPaths(new Set()); // Clear selection after successful move
      await loadItems(currentPath); // Refresh list
    } catch (err: any) {
      console.error(`[Move] Confirm failed:`, err);
      const message = err instanceof Error ? err.message : String(err);
      notifyError(`Move failed: ${message}`); // Toast error
      // Keep move active on error? Or cancel? Let's cancel for now.
      // setItemsToMovePaths([]);
      // setIsMoveActive(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelMove = () => {
    console.log('[Move] Cancelling move operation.');
    setIsMoveActive(false);
    setItemsToMovePaths([]);
    // Clear selection when cancelling move
    setSelectedPaths(new Set());
  };
  // --- END NEW Move Handlers ---

  // --- Update Copy/Paste Handlers ---
  const handleCopySelected = () => {
    if (selectedPaths.size === 0) return;
    console.log('[Copy] Copying items:', Array.from(selectedPaths));
    setCopiedItemPaths(Array.from(selectedPaths));
    // --- Cancel any active move ---
    setIsMoveActive(false);
    setItemsToMovePaths([]);
    // --- End Cancel ---
    setSelectedPaths(new Set()); // Clear selection
  };

  // This handler is now ONLY for pasting copied items
  const handlePasteCopied = async () => {
    if (copiedItemPaths.length === 0) {
      console.warn('[Paste] No items copied.');
      return;
    }

    const destinationFolderPath = currentPath;
    const itemsToProcess = copiedItemPaths;
    const operation = 'copy';
    console.log(`[Paste] Pasting (Copy) ${itemsToProcess.length} items to "${destinationFolderPath}"`);

    // Prevent pasting into own subfolder (simple check)
    for (const sourcePath of itemsToProcess) {
        if (destinationFolderPath.startsWith(sourcePath + '/')) {
            notifyError(`Cannot ${operation} a folder into its own subfolder.`);
            return;
        }
    }

    setIsLoading(true);
    setError(null);
    try {
      await fileSystemService.copyItems(itemsToProcess, destinationFolderPath);
      notifySuccess(`Pasted ${itemsToProcess.length} item(s).`); // Success toast
      // --- Clear copied items after successful paste ---
      setCopiedItemPaths([]);
      // --- End Clear ---
      await loadItems(currentPath); // Refresh list
    } catch (err: any) {
      console.error(`[Paste] ${operation} failed:`, err);
      const message = err instanceof Error ? err.message : String(err);
      notifyError(`Paste failed: ${message}`); // Toast error
    } finally {
      setIsLoading(false);
    }
  };
  // --- END Update Copy/Paste Handlers ---

  // --- NEW: Drag and Drop Handlers ---
  const handleDragStart = (event: React.DragEvent, itemPath: string) => {
    console.log('[DragStart] Dragging:', itemPath);
    setDraggedItemPath(itemPath);
    // Optional: Set drag effect
    event.dataTransfer.effectAllowed = 'move';
    // Optional: Set data (useful if dragging outside the window, but not strictly needed here)
    // event.dataTransfer.setData('text/plain', itemPath);
  };

  const handleDragEnd = () => {
    // Clear drag state when drag operation ends (dropped or cancelled)
    console.log('[DragEnd] Drag ended');
    setDraggedItemPath(null);
    setDragOverPath(null); // Clear visual feedback
  };

  const handleDragOver = (event: React.DragEvent, targetPath: string) => {
    event.preventDefault(); // Necessary to allow dropping
    event.dataTransfer.dropEffect = 'move';
    if (targetPath !== dragOverPath) {
        setDragOverPath(targetPath); // Set target for visual feedback
    }
  };

  const handleDragEnter = (event: React.DragEvent, targetPath: string) => {
    event.preventDefault();
    // Ensure the target is a potential drop zone (folder) and not the item itself
    const targetItem = items.find(i => i.path === targetPath);
    if (targetItem?.isDirectory && targetPath !== draggedItemPath) {
        setDragOverPath(targetPath);
    }
  };

  const handleDragLeave = (event: React.DragEvent, targetPath: string) => {
    event.preventDefault();
    // Check if the related target (where the cursor moved to) is outside the current element
    const relatedTarget = event.relatedTarget as Node;
    if (!event.currentTarget.contains(relatedTarget)) {
        if (targetPath === dragOverPath) {
            setDragOverPath(null); // Clear visual feedback if leaving the element entirely
        }
    }
  };

  const handleDrop = async (event: React.DragEvent, targetFolderPath: string) => {
    event.preventDefault();
    setDragOverPath(null); // Clear visual feedback

    if (!draggedItemPath) {
      console.warn('[Drop] No dragged item path found.');
      return;
    }

    if (draggedItemPath === targetFolderPath) {
      console.warn('[Drop] Cannot drop item onto itself.');
      setDraggedItemPath(null); // Clear drag state
      return;
    }

    // Prevent dropping into a subfolder of itself
    if (targetFolderPath.startsWith(draggedItemPath + '/')) {
        console.warn('[Drop] Cannot drop a folder into its own subfolder.');
        notifyError("Cannot move a folder into one of its own subfolders.");
        setDraggedItemPath(null); // Clear drag state
        return;
    }

    console.log(`[Drop] Attempting move: "${draggedItemPath}" to folder "${targetFolderPath}"`);

    // --- Implement move logic ---
    try {
      setIsLoading(true); // Indicate operation
      setError(null);
      await fileSystemService.moveItem(draggedItemPath, targetFolderPath);
      notifySuccess(`Moved "${path.basename(draggedItemPath)}".`); // Success toast
      await loadItems(currentPath); // Refresh list after successful move
    } catch (err: any) {
      console.error('Move failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      notifyError(`Move failed: ${message}`); // Toast error
    } finally {
      setIsLoading(false);
      setDraggedItemPath(null); // Clear drag state regardless of success/failure
    }
    // --- End implementation ---
  };
  // --- END NEW ---

  // --- NEW Rename Handlers ---
  const handleRenameStart = () => {
    if (selectedPaths.size !== 1) return; // Should be disabled in toolbar, but double-check
    const path = Array.from(selectedPaths)[0];
    console.log('[Rename] Starting rename for:', path);
    setRenamingPath(path);
    setTempNewName(path.split('/').pop() || ''); // Set initial input value to current name
    setSelectedPaths(new Set()); // Clear selection when renaming starts
    // Cancel move/copy if active
    setIsMoveActive(false);
    setItemsToMovePaths([]);
    setCopiedItemPaths([]);
  };

  const handleRenameConfirm = async (originalPath: string, newName: string) => {
    if (!newName || newName === originalPath.split('/').pop()) {
      handleRenameCancel(); // Cancel if name is empty or unchanged
      return;
    }
    // Basic validation (e.g., prevent slashes)
    if (newName.includes('/')) {
        notifyError("New name cannot contain slashes.");
        // Optionally refocus input
        return;
    }

    const directory = path.dirname(originalPath);
    // --- Correct newPath calculation for root and subdirectories ---
    // If directory is '.', it means the item is in the root.
    const newPath = directory === '.' ? newName : `${directory}/${newName}`;
    // --- End Correction ---

    console.log(`[Rename] Confirming rename: "${originalPath}" to "${newPath}"`);

    setIsLoading(true);
    setError(null);
    try {
      await fileSystemService.renameItem(originalPath, newPath);
      notifySuccess(`Renamed to "${newName}".`); // Success toast
      setRenamingPath(null); // Exit rename mode
      setTempNewName('');
      await loadItems(currentPath); // Refresh list
    } catch (err: any) {
      console.error('[Rename] Failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      notifyError(`Rename failed: ${message}`); // Toast error
      setRenamingPath(null);
      setTempNewName('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameCancel = () => {
    console.log('[Rename] Cancelling rename.');
    setRenamingPath(null);
    setTempNewName('');
  };
  // --- END Rename Handlers ---

  // --- NEW Create Folder Handler ---
  const handleCreateFolder = async () => {
    const folderName = prompt("Enter new folder name:");
    if (!folderName || !folderName.trim()) {
      return; // Cancelled or empty name
    }
    // Basic validation
    if (folderName.includes('/')) {
        notifyError("Folder name cannot contain slashes.");
        return;
    }

    const newFolderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    console.log(`[Create Folder] Attempting to create: "${newFolderPath}"`);

    setIsLoading(true);
    setError(null);
    try {
      await fileSystemService.createDirectory(newFolderPath);
      notifySuccess(`Created folder "${folderName}".`); // Success toast
      await loadItems(currentPath); // Refresh list
    } catch (err: any) {
      console.error('[Create Folder] Failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      notifyError(`Create folder failed: ${message}`); // Toast error
    } finally {
      setIsLoading(false);
    }
  };
  // --- END Create Folder Handler ---

  // --- Context Menu Handlers ---
  const handleContextMenu = (event: React.MouseEvent, item: BlobItem) => {
    event.preventDefault();
    // Ensure other operations are cancelled/inactive
    if (isMoveActive || renamingPath) return;

    console.log('[ContextMenu] Showing for:', item.path);
    show({
      event,
      props: { // Pass item data to menu item handlers
        itemPath: item.path,
        itemName: item.name,
        isDirectory: item.isDirectory,
        // Pass the full item for easier metadata access
        item: item,
      }
    });
  };

  const handleContextDownload = async (props: any) => {
    const { itemPath, itemName, isDirectory } = props?.props || {};
    if (!itemPath) {
      console.warn('[ContextMenu] Download cancelled: No item path provided.');
      return;
    }

    setError(null); // Clear previous errors
    console.log(`[ContextMenu] Download requested for ${isDirectory ? 'folder' : 'file'}: "${itemPath}"`); // Added detail

    if (isDirectory) {
      // --- Download folder as zip ---
      console.log('[ContextMenu] Calling downloadZip service for folder:', itemPath); // Added detail
      setIsZipping(true);
      try {
          await fileSystemService.downloadZip([itemPath]); // Pass path in an array
          console.log('[ContextMenu] downloadZip call succeeded for folder:', itemPath); // Added detail
      } catch (err: any) {
          console.error('[ContextMenu] downloadZip failed for folder:', itemPath, err); // Added detail
          const message = err instanceof Error ? err.message : String(err);
          notifyError(`ZIP Download failed: ${message}`);
      } finally {
          setIsZipping(false);
      }
      // --- End Download folder ---
    } else {
      // --- Download single file: Open SAS URL directly ---
      console.log('[ContextMenu] Calling getDownloadUrl service for file:', itemPath); // Added detail
      // Optionally set a loading state specific to this action if needed
      try {
          const url = await fileSystemService.getDownloadUrl(itemPath);
          console.log('[ContextMenu] Received SAS URL, opening in new tab:', url); // Added detail
          window.open(url, '_blank'); // Open URL, browser handles download
      } catch (err: any) {
          console.error('[ContextMenu] getDownloadUrl failed for file:', itemPath, err); // Added detail
          const message = err instanceof Error ? err.message : String(err);
          notifyError(`Download failed: ${message}`); // Use notifyError
      } finally {
          // Optionally clear loading state
      }
      // --- End Change ---
    }
  };

  const handleContextProperties = async (props: any) => {
    const { itemPath } = props?.props || {};
    if (!itemPath) return;
    console.log('[ContextMenu] Getting properties for:', itemPath);

    // --- Fetch and Show Properties ---
    setIsPropertiesLoading(true);
    setPropertiesError(null);
    setPropertiesItem(null);
    try {
      const fetchedProperties = await fileSystemService.getItemProperties(itemPath);
      setPropertiesItem(fetchedProperties);
    } catch (err: any) { // Use 'any' or 'unknown'
      console.error('[Properties] Failed:', err);
      // Use type guard for Error objects
      const message = err instanceof Error ? err.message : String(err);
      setPropertiesError(message || 'Failed to get properties.');
    } finally {
      setIsPropertiesLoading(false);
    }
    // --- End Fetch and Show ---
  };

  // --- NEW: Context Menu Edit Metadata Handler ---
  const handleContextEditMetadata = (props: any) => {
      const { itemPath, itemName, isDirectory, item } = props?.props || {};
      if (!itemPath || isDirectory || !item) {
          console.warn('[ContextMenu Edit] Cannot edit metadata for directory or missing item data.');
          return;
      }

      console.log('[ContextMenu Edit] Editing metadata for:', itemPath);

      // Parse the raw metadata from the BlobItem
      const existingMetadata = parseBlobMetadataToFileMetadata(item.metadata || {});

      setEditingMetadataItem({
          path: itemPath,
          name: itemName,
          metadata: existingMetadata,
      });
      setIsMetadataModalOpen(true); // Open the modal
  };
  // --- END NEW ---

  const handleClosePropertiesModal = () => {
    setPropertiesItem(null);
    setPropertiesError(null);
  };
  // --- END Context Menu Handlers ---

  const canPasteCopied = copiedItemPaths.length > 0;

  // --- NEW Sort Handler ---
  const handleSort = (key: SortKey) => {
    // Add type annotation for prevDirection
    setSortDirection((prevDirection: SortDirection) =>
      sortKey === key ? (prevDirection === 'asc' ? 'desc' : 'asc') : 'asc'
    );
    setSortKey(key);
    console.log(`[Sort] Key: ${key}, Direction: ${sortKey === key ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc'}`);
  };
  // --- END NEW ---

  // --- Memoize Sorted Items ---
  const sortedItems = useMemo(() => {
    // --- Add check for items array ---
    if (!Array.isArray(items)) {
        console.error("[Sort] Items is not an array:", items);
        return [];
    }
    // --- End check ---
    const sorted = [...items].sort((a, b) => {
        // --- Add more robust checks for item validity ---
        const validA = a && typeof a.name === 'string' && typeof a.path === 'string';
        const validB = b && typeof b.name === 'string' && typeof b.path === 'string';

        if (!validA || !validB) {
            // Log the invalid item(s) for debugging
            if (!validA) console.warn('[Sort] Invalid item encountered:', a);
            if (!validB) console.warn('[Sort] Invalid item encountered:', b);
            // Ensure consistent sorting: invalid items go last
            if (!validA && !validB) return 0;
            return !validA ? 1 : -1;
        }
        // --- End checks ---


        // Always put directories first when sorting by name or lastModified
        if (sortKey !== 'size') {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
        }

        let compareA: string | number | Date | undefined;
        let compareB: string | number | Date | undefined;

        switch (sortKey) {
            case 'size':
                // Treat directories as having size -1 or 0 for sorting purposes if needed
                compareA = a.isDirectory ? -1 : a.size ?? -1;
                compareB = b.isDirectory ? -1 : b.size ?? -1;
                break;
            case 'lastModified':
                // Ensure lastModified exists before creating Date
                compareA = a.lastModified ? new Date(a.lastModified) : new Date(0);
                compareB = b.lastModified ? new Date(b.lastModified) : new Date(0);
                break;
            case 'name':
            default:
                // name is guaranteed string here due to checks above
                compareA = a.name.toLowerCase();
                compareB = b.name.toLowerCase();
                break;
        }

        // This check should ideally not be needed if filtering works, but keep as safeguard
        if (compareA === undefined || compareB === undefined) return 0;

        let comparison = 0;
        if (compareA < compareB) {
            comparison = -1;
        } else if (compareA > compareB) {
            comparison = 1;
        }

        return sortDirection === 'asc' ? comparison : comparison * -1;
    });
    return sorted;
  }, [items, sortKey, sortDirection]);
  // --- END Memoize ---

  const filteredItems = useMemo(() => {
    if (!query) return sortedItems;
    const lower = query.toLowerCase();
    return sortedItems.filter(item =>
    item.name.toLowerCase().includes(lower)
    );
    }, [sortedItems, query]);

  // --- NEW: Handler for single item download button ---
  const handleDownloadSingle = async (item: BlobItem) => {
    setError(null);
    if (item.isDirectory) {
      // --- Download folder as zip ---
      console.log('[Download] Downloading folder as ZIP:', item.path);
      setIsZipping(true);
      try {
          await fileSystemService.downloadZip([item.path]); // Pass path in an array
      } catch (err: any) {
          console.error('ZIP Download failed:', err);
          const message = err instanceof Error ? err.message : String(err);
          notifyError(`ZIP Download failed: ${message}`);
      } finally {
          setIsZipping(false);
      }
      // --- End Download folder ---
    } else {
      // Download single file
      console.log('[Download] Getting SAS URL for download:', item.path);
      // Optionally set loading state if getting URL takes time
      try {
          const url = await fileSystemService.getDownloadUrl(item.path);
          window.open(url, '_blank'); // Open URL, browser handles download
          console.log('[Download] Opened SAS URL:', url);
      } catch (err: any) {
          console.error('Download failed:', err);
          const message = err instanceof Error ? err.message : String(err);
          notifyError(`Download failed: ${message}`);
      } finally {
          // Optionally clear loading state
      }
    }
  };

  useEffect(() => {
    fileSystemService.listFiles().then(data => {
      // if API returns flat paths, convert to tree here
      setAllNodes(data as unknown as Node[]);
    });
  }, []);

  // 2) Filter whenever allNodes or query changes
  const filtered = useMemo(
    () => fileSystemService.filterTree(allNodes, query),
    [allNodes, query]
  );
  // --- END NEW ---

  // --- Fix JSX Structure ---
  return (
    <div className={styles.container}> {/* Single top-level element */}
      {/* Add Toast Container */}
      <ToastContainer
        position="bottom-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <h2>Basic Azure File System</h2>

      {/* --- Update Upload Section to use new trigger --- */}
      <UploadSection
        isLoading={isLoading}
        uploading={uploading} // Keep using uploading state for general feedback
        onFileUpload={handleFileUploadTrigger} // Use the trigger function
      />
      {/* --- End Update --- */}

      <Toolbar
        selectedCount={selectedPaths.size}
        isMoveActive={isMoveActive}
        canPasteCopied={canPasteCopied}
        onDeleteSelected={handleDeleteSelected}
        onDownloadZipSelected={handleDownloadZipSelected}
        onStartMove={handleStartMove}
        onConfirmMove={handleConfirmMove}
        onCancelMove={handleCancelMove}
        onCopySelected={handleCopySelected}
        onPasteCopied={handlePasteCopied}
        onCreateFolder={handleCreateFolder}
        onRenameStart={handleRenameStart}
        isZipping={isZipping}
        isLoading={isLoading}
        currentPath={currentPath}
        onNavigateUp={navigateUp}
      />
      
      <SearchBar onSearch={setQuery} />
      <StatusDisplay isLoading={isLoading} error={error} />

      {!isLoading && !error && (
        
         <FileListDisplay
            // --- Pass sorted items ---
            items={filteredItems}
            // --- Pass sort state and handler ---
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            // --- End Pass ---
            // --- Pass missing isLoading prop ---
            isLoading={isLoading}
            // --- End Pass ---
            onDelete={handleDeleteSingle}
            onItemDoubleClick={handleItemDoubleClick}
            selectedPaths={selectedPaths}
            onItemSelect={handleItemSelect}
            itemsToMovePathsSet={new Set(itemsToMovePaths)}
            renamingPath={renamingPath}
            tempNewName={tempNewName}
            onTempNewNameChange={setTempNewName}
            onRenameConfirm={handleRenameConfirm}
            onRenameCancel={handleRenameCancel}
            onContextMenu={handleContextMenu}
            draggedItemPath={draggedItemPath}
            dragOverPath={dragOverPath}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onSelectAll={handleSelectAll}
            // --- Pass new download handler ---
            onDownload={handleDownloadSingle}
            // --- End Pass ---
            // --- Pass highlightedPath prop ---
            highlightedPath={highlightedPath}
            // --- End Pass ---
          />
      )}

      <FilePreviewModal
        item={previewItem}
        onClose={handleCloseModal}
      />

      {/* Render the Properties Modal */}
      <PropertiesModal
        properties={propertiesItem}
        isLoading={isPropertiesLoading}
        error={propertiesError}
        onClose={handleClosePropertiesModal}
      />

      {/* --- Render Metadata Modal --- */}
      {isMetadataModalOpen && (
          <MetadataModal
              // Pass the file object if uploading, null if editing existing metadata
              file={fileToUpload}
              isOpen={isMetadataModalOpen}
              onClose={() => {
                  setIsMetadataModalOpen(false);
                  setFileToUpload(null);
                  setEditingMetadataItem(null); // Clear editing state on close
              }}
              onUpload={handleUploadWithMetadata}
              // Pass the path of the item being edited or the current directory for new uploads
              currentDirectory={editingMetadataItem ? path.dirname(editingMetadataItem.path) : currentPath}
              // Pass initial metadata if editing
              initialMetadata={editingMetadataItem?.metadata}
              // Pass the specific path if editing, otherwise null/undefined
              editingItemPath={editingMetadataItem?.path}
          />
      )}
      {/* --- End Render --- */}


      {isZipping && <div className={styles.loading}>Creating ZIP file...</div>}

      {/* Context Menu Component - Placed inside the main div */}
      {/* --- FIX: Move Items inside Menu --- */}
      <Menu id={MENU_ID} theme="light" animation="fade">
        <Item onClick={handleContextDownload}>
          Download
        </Item>
        {/* --- NEW: Edit Metadata Item --- */}
        <Item
            onClick={handleContextEditMetadata}
            // Disable if the context item is a directory
            disabled={({ props }) => props?.isDirectory === true}
        >
          Edit Metadata
        </Item>
        {/* --- END NEW --- */}
        <Item onClick={handleContextProperties}>
          Properties
        </Item>
      </Menu>
      {/* --- END FIX --- */}

    </div> // Closing tag for the main container div
  );
}; // Closing tag for the component function

export default BasicFileSystem;