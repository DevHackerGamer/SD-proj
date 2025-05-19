import React, { useState, useEffect, useCallback, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { fileSystemService } from './FileSystemService';
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
// --- Import required icons for delete modal ---
import { FaFolder, FaFile } from 'react-icons/fa';
// --- End Import ---

// Add import for MetadataFilterBar
import MetadataFilterBar from './components/MetadataFilterBar';

// Add new import for search bar icons and styling
import { FaSearch, FaTimesCircle, FaMicrophone } from 'react-icons/fa';

// Import metadataOptions to have access to all possible tag values
import metadataOptionsData from '../../components/managefields/metadataOptions.json';

const MENU_ID = "file-item-menu";

// Define a ref type for external components to trigger the file upload
export type FileSystemRefType = {
  triggerFileUpload: () => void;
  navigateToPath: (path: string) => void;
};

// Add this new component before the BasicFileSystem component
const NLPSearchBar: React.FC<{
  onSearch: (query: string) => void;
  isSearching: boolean;
  onClearSearch?: () => void; // Add optional callback for clearing search
}> = ({ onSearch, isSearching, onClearSearch }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const clearSearch = () => {
    setQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
    // Call the parent's onClearSearch if it exists
    if (onClearSearch) {
      onClearSearch();
    }
  };

  // Simulate voice input (in a real app, you'd use Web Speech API)
  const toggleVoiceInput = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }
    
    setIsListening(true);
    // Simulate voice recognition with a timeout
    setTimeout(() => {
      setQuery(prev => prev + " Find documents about land reform");
      setIsListening(false);
    }, 2000);
  };

  return (
    <div className={styles.nlpSearchContainer}>
      <form onSubmit={handleSubmit} className={styles.nlpSearchForm}>
        <div 
          className={`${styles.searchInputWrapper} ${isFocused ? styles.focused : ''}`}
        >
          <FaSearch className={styles.searchIcon} />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ask anything about your documents..."
            className={styles.nlpSearchInput}
            disabled={isSearching}
          />
          {query && (
            <button 
              type="button" 
              onClick={clearSearch} 
              className={styles.clearSearchButton}
              aria-label="Clear search"
            >
              <FaTimesCircle />
            </button>
          )}
          <button 
            type="button"
            onClick={toggleVoiceInput}
            className={`${styles.voiceSearchButton} ${isListening ? styles.listening : ''}`}
            aria-label="Voice search"
          >
            <FaMicrophone />
          </button>
        </div>
        <button 
          type="submit" 
          className={styles.searchButton}
          disabled={!query.trim() || isSearching}
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>
      <div className={styles.searchExamples}>
        <p>Examples: <span onClick={() => setQuery("Show PDF files with 'land reform' from 2020")}>Show PDF files with 'land reform' from 2020</span> • <span onClick={() => setQuery("Find documents about constitutional development")}>Find documents about constitutional development</span></p>
      </div>
    </div>
  );
};

// Convert to forwardRef to expose methods to parent components
const BasicFileSystem = forwardRef<FileSystemRefType, {}>((props, ref) => {
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
  // Add state for delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [itemsToDelete, setItemsToDelete] = useState<BlobItem[]>([]);

  // Add state for selected metadata tags
  const [selectedMetadataTags, setSelectedMetadataTags] = useState<{ category: string, tag: string }[]>([]);
  // Add these state variables for filtering before they're used in sortedItems
  const [isFilterActive, setIsFilterActive] = useState<boolean>(false);
  const [filteredItems, setFilteredItems] = useState<BlobItem[]>([]);
  const [isMetadataSearchMode, setIsMetadataSearchMode] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  // --- Context Menu Hook ---
  const { show } = useContextMenu({ id: MENU_ID });
  // --- End Context Menu ---

  // --- Helper to show notifications ---
  const notifySuccess = (message: string) => toast.success(message);
  const notifyError = (message: string) => toast.error(message);
  const notifyInfo = (message: string) => toast.info(message);
  // --- End Helper ---

  // Create a ref for the file input element
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    triggerFileUpload: () => {
      // Trigger the file input click programmatically
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    },
    navigateToPath: (path: string) => {
      // Call the existing navigateToPath function
      navigateToPath(path);
    }
  }));

  // Function to check if paths were actually modified before triggering a move
  const pathsActuallyDifferent = (oldPath: string, newPath: string): boolean => {
      // Normalize both paths to ensure consistent comparison
      const normalizedOldPath = oldPath.replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase();
      const normalizedNewPath = newPath.replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase();
      
      // If exactly the same, no change
      if (normalizedOldPath === normalizedNewPath) return false;
      
      // Get directory parts
      const oldDir = path.dirname(normalizedOldPath);
      const newDir = path.dirname(normalizedNewPath);
      
      return oldDir !== newDir;
  };

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

  // --- Rename handleUploadWithMetadata to handleSaveMetadata and update logic ---
  const handleSaveMetadata = async (metadata: FileMetadata, targetPath: string, isEditing: boolean, file?: File | null) => {
      setUploading(true); // Use uploading state for both upload and update
      setError(null);
      setHighlightedPath(null);
      console.log(`[Save Metadata Handler] Starting save. Is Editing: ${isEditing}, Path: ${targetPath}`);

      try {
          let resultMessage = '';
          let resultPath = targetPath; // Use targetPath as the default path

          if (isEditing) {
              // Get the directory and filename from the current path
              const currentDir = path.dirname(targetPath);
              const fileName = path.basename(targetPath);
              
              // Fetch current metadata to compare if path-related fields changed
              const directoryMetadata = await withAuthRetry(() => 
                  fileSystemService.getDirectoryMetadata(currentDir)
              );
              const currentMetadata = directoryMetadata?.files?.[fileName];
              
              // Generate new path based on updated metadata
              const newPath = generatePathFromMetadata(metadata, fileName);
              const newDir = path.dirname(newPath);
              
              // Use more strict path comparison to detect real changes
              const pathChanged = pathsActuallyDifferent(targetPath, newPath);
              console.log(`[Save Metadata] Current path: ${targetPath}, New path would be: ${newPath}, Path changed: ${pathChanged}`);
              
              if (pathChanged) {
                  try {
                      // 1. Ensure the new directory exists
                      await ensureDirectoryExists(newDir);
                      
                      // 2. Update metadata first to avoid re-fetching later
                      await fileSystemService.updateBlobMetadata(targetPath, metadata);
                      
                      // 3. Move the file to the new directory with retry logic for auth errors
                      console.log(`[Save Metadata] Moving file from "${targetPath}" to "${newPath}"`);
                      await withAuthRetry(() => fileSystemService.moveItem(targetPath, newDir));
                      
                      // 4. Check if old directory is now empty and delete if appropriate
                      // Only auto-delete if the directory is part of the managed structure
                      await checkAndDeleteEmptyDirectory(currentDir);
                      
                      resultPath = newPath;
                      resultMessage = `File moved to new location based on metadata and updated successfully.`;
                  } catch (moveError: unknown) {
                      console.error('[Save Metadata] Error during file move:', moveError);
                      // Extract error message in a type-safe way
                      let errorMessage = 'Unknown error';
                      
                      if (moveError instanceof Error) {
                          errorMessage = moveError.message;
                      } else if (typeof moveError === 'object' && moveError !== null) {
                          // Handle axios or other error objects
                          errorMessage = String((moveError as any).message || (moveError as any).statusText || JSON.stringify(moveError));
                      } else if (typeof moveError === 'string') {
                          errorMessage = moveError;
                      }
                      
                      // Check for authentication errors
                      if (errorMessage.includes('403') || 
                          errorMessage.includes('authentication') || 
                          errorMessage.includes('Authorization header')) {
                          throw new Error(`Azure authentication error: Your session may have expired. Please refresh the page and try again.`);
                      } else {
                          throw new Error(`Metadata was updated but failed to move file: ${errorMessage}`);
                      }
                  }
              } else {
                  // Just update metadata if path hasn't changed or if the only change
                  // is in parts that don't affect the directory structure
                  const updateResult = await fileSystemService.updateBlobMetadata(targetPath, metadata);
                  resultMessage = updateResult.message || `Metadata updated successfully for "${fileName}".`;
              }
          } else {
              // --- Call uploadFile service (requires file) ---
              if (!file) {
                  throw new Error("File is required for new uploads.");
              }
              console.log(`[Save Metadata Handler] Calling uploadFile for: ${file.name} to ${targetPath}`);
              const uploadResult = await fileSystemService.uploadFile(file, metadata, targetPath);
              if (!uploadResult || typeof uploadResult.filePath !== 'string') {
                  console.error('[Save Metadata Handler] Invalid response from upload service:', uploadResult);
                  throw new Error('Upload completed, but received an invalid response from the server.');
              }
              resultPath = uploadResult.filePath; // Use the path returned by the upload service
              resultMessage = `File "${path.basename(resultPath)}" uploaded successfully.`;
              // --- End Call ---
          }

          notifySuccess(resultMessage);

          // --- Focus/Highlight Logic (use resultPath) ---
          const targetDirectory = path.dirname(resultPath);
          const navigateAndHighlight = async () => {
              await new Promise(resolve => setTimeout(resolve, 100)); // Short delay
              setHighlightedPath(resultPath);
              setTimeout(() => setHighlightedPath(null), 3000); // Highlight duration
          };

          if (targetDirectory === '.' || targetDirectory === currentPath) {
              await loadItems(currentPath); // Refresh current view
              console.log(`[Save Metadata Handler] Refreshed current directory: ${currentPath}`);
              await navigateAndHighlight();
          } else {
              // Navigate if upload resulted in a different directory (less likely for edits)
              setCurrentPath(targetDirectory);
              console.log(`[Save Metadata Handler] Navigated to target directory: ${targetDirectory}`);
              // loadItems will be triggered by useEffect for currentPath change
              // Need to ensure highlight happens *after* navigation and load
              // We might need a more robust way to trigger highlight post-load
              setTimeout(navigateAndHighlight, 500); // Delay highlight slightly after navigation
          }
          // --- End Focus/Highlight ---

          // Close modal on success
          setIsMetadataModalOpen(false);
          setFileToUpload(null);
          setEditingMetadataItem(null);

      } catch (err: any) {
          console.error(`[Save Metadata Handler] ${isEditing ? 'Update' : 'Upload'} failed:`, err);
          const message = err instanceof Error ? err.message : String(err);
          notifyError(`${isEditing ? 'Update' : 'Upload'} failed: ${message}`);
          throw err; // Re-throw for modal to display error
      } finally {
          setUploading(false);
      }
  };
  
  // Helper function to generate a path from metadata (customize this according to your path structure)
  const generatePathFromMetadata = (metadata: FileMetadata, fileName: string): string => {
      const pathParts: string[] = [];
      const sp = metadata.structuredPath || {};
      
      // Add path parts based on metadata fields that should affect the path
      // Following the structure: /{collection}/{jurisdiction}/{thematic_focus}/{issuing_authority}/{document_function}/{version}/{workflow_stage}/{item}/
      
      // Part 1: Collection
      if (sp.collection) {
          pathParts.push(sp.collection);
      }
      
      // Part 2: Jurisdiction
      if (sp.jurisdiction?.name) {
          pathParts.push(sp.jurisdiction.name);
      }
      
      // Part 3: Thematic Focus
      if (sp.thematicFocus?.primary) {
          pathParts.push(sp.thematicFocus.primary);
      }
      
      // Part 4: Issuing Authority
      if (sp.issuingAuthority?.name) {
          pathParts.push(sp.issuingAuthority.name);
      }
      
      // Part 5: Document Function
      if (sp.documentFunction) {
          pathParts.push(sp.documentFunction);
      }
      
      // Part 6: Version
      if (sp.version) {
          pathParts.push(sp.version);
      }
      
      // Part 7: Workflow Stage
      if (sp.workflowStage?.primary) {
          const workflowPart = sp.workflowStage.sub 
              ? `${sp.workflowStage.primary}_${sp.workflowStage.sub}` 
              : sp.workflowStage.primary;
          pathParts.push(workflowPart);
      }
      
      // If no parts were determined, return just the filename (current directory)
      if (pathParts.length === 0) {
          return fileName;
      }
      
      // Join parts and add filename
      return path.join(pathParts.join('/'), fileName);
  };
  
  // Helper to ensure a directory exists
  const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
      if (!dirPath || dirPath === '.' || dirPath === '') return;
      
      try {
          // Try to list the directory contents - if this succeeds, directory exists
          await fileSystemService.listFiles(dirPath);
      } catch (error) {
          console.log(`[Save Metadata] Directory "${dirPath}" doesn't exist, creating it`);
          // Create the directory if listing failed (likely doesn't exist)
          await fileSystemService.createDirectory(dirPath);
      }
  };
  
  // Modified helper to check if a directory is empty and delete it IF it should be auto-cleaned
  const checkAndDeleteEmptyDirectory = async (dirPath: string): Promise<void> => {
      if (!dirPath || dirPath === '.' || dirPath === '') return;
      
      try {
          // Check if the directory path includes any of the auto-managed folders
          // This prevents deleting folders outside your managed structure
          const managedPathParts = [
              'collection', 
              'jurisdiction', 
              'thematicFocus', 
              'issuingAuthority', 
              'documentFunction', 
              'version', 
              'workflowStage'
          ];
          
          // Only auto-delete if directory is part of your managed structure
          const shouldAutoDelete = managedPathParts.some(part => 
              dirPath.toLowerCase().includes(part.toLowerCase())
          );
          
          if (!shouldAutoDelete) {
              console.log(`[Save Metadata] Directory "${dirPath}" is not part of managed folder structure. Skipping auto-delete check.`);
              return;
          }
          
          // Check if directory is empty
          const items = await fileSystemService.listFiles(dirPath);
          if (items.length === 0) {
              console.log(`[Save Metadata] Directory "${dirPath}" is empty and part of managed structure, deleting it`);
              await fileSystemService.deleteItem(dirPath);
              
              // Check parent directory (but only if we're in a managed folder)
              const parentDir = path.dirname(dirPath);
              if (parentDir && parentDir !== '.' && parentDir !== dirPath) {
                  await checkAndDeleteEmptyDirectory(parentDir);
              }
          } else {
              console.log(`[Save Metadata] Directory "${dirPath}" still contains ${items.length} items, not deleting`);
          }
      } catch (error) {
          console.warn(`[Save Metadata] Error checking or deleting directory "${dirPath}":`, error);
      }
  };

  // Add a new helper function to handle retry logic for Azure operations (add this near your other helpers) Modified helper to check if a directory is empty and delete it IF it should be auto-cleaned
  const withAuthRetry = async <T,>(operation: () => Promise<T>, maxRetries = 2): Promise<T> => {
    let lastError: unknown;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // For the first attempt, just try the operation
            if (attempt === 0) {
                return await operation();
            }
            
            // For subsequent attempts, display a notification and potentially refresh tokens
            notifyInfo(`Azure authentication issue detected. Retrying operation (attempt ${attempt}/${maxRetries})...`);
            
            // Add a small delay between retries - increasing with each attempt
            await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
            
            // Before retry, attempt to refresh authentication if possible
            try {
                // If you have a token refresh mechanism available through your API, call it here
                // await fileSystemService.refreshAuthToken();
                console.log(`[Azure Auth] Attempting retry ${attempt} with potentially refreshed credentials`);
            } catch (refreshError) {
                console.warn('[Azure Auth] Error refreshing auth token:', refreshError);
                // Continue with retry even if refresh fails
            }
            
            return await operation();
        } catch (error) {
            lastError = error;
            
            // Improved detection of Azure authentication-related errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isAuthError = 
                errorMessage.includes('403') || 
                errorMessage.includes('authentication') || 
                errorMessage.includes('Authorization header') ||
                errorMessage.includes('Server failed to authenticate') ||
                errorMessage.includes('AuthenticationFailed') ||
                errorMessage.includes('token expired');
            
            if (!isAuthError || attempt === maxRetries) {
                throw error; // Don't retry for non-auth errors or if we've hit max retries
            }
            
            console.warn(`[Azure Auth] Authentication error on attempt ${attempt}, retrying...`, error);
        }
    }
    
    // If we got here, all retries failed with auth errors
    throw new Error(`Azure authentication failed after ${maxRetries} retry attempts. Please refresh the page or check your login status.`);
};

  // --- End Rename and Update ---


  // --- Modified handleDelete for single item (keep for individual delete buttons) ---
  const handleDeleteSingle = async (itemPath: string) => {
    const itemToDelete = items.find(item => item.path === itemPath);
    if (!itemToDelete) return;
    
    setItemsToDelete([itemToDelete]);
    setShowDeleteModal(true);
  };

  // New function to execute delete after confirmation with improved directory navigation  
  const executeDelete = async () => {
    setShowDeleteModal(false);
    
    if (itemsToDelete.length === 0) return;
    
    const pathsToDelete = itemsToDelete.map(item => item.path);
    const isNavigationNeeded = checkIfNavigationNeeded(pathsToDelete);
    let targetNavigationPath = findSafeNavigationPath(pathsToDelete);
    
    // Save the count of non-deleted items in current dir before deletion
    const currentDirBeforeDeletion = currentPath;
    const nonDeletedItemsInCurrent = items.filter(item => 
      !pathsToDelete.includes(item.path) && 
      path.dirname(item.path) === currentPath
    );
    
    setError(null);
    console.log('Deleting selected items:', pathsToDelete);
    setIsLoading(true);
    let successCount = 0;
    let errorMessages: string[] = []; 
    
    for (const itemPath of pathsToDelete) {
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
    setItemsToDelete([]);
    
    // Handle navigation and refresh logic based on what was deleted
    try {
      if (isNavigationNeeded) {
        // We're deleting current dir or a parent, use the calculated safe path
        console.log(`[Delete] Directory navigation needed, moving to: ${targetNavigationPath}`);
        setCurrentPath(targetNavigationPath);
      } else if (nonDeletedItemsInCurrent.length === 0 && currentPath !== '') {
        // If we deleted all items in current directory (and not at root), go up one level
        const parentPath = path.dirname(currentPath) === '.' ? '' : path.dirname(currentPath);
        console.log(`[Delete] Current directory empty after deletion, navigating up to: ${parentPath || 'root'}`);
        setCurrentPath(parentPath);
      } else {
        // Just refresh the current view 
        console.log(`[Delete] Refreshing current directory: ${currentPath}`);
        await loadItems(currentPath);
      }
    } catch (err) {
      console.error('[Delete] Error during post-deletion navigation:', err);
      // Fallback - if anything goes wrong with the smart navigation, just reload current path
      await loadItems(currentPath);
    }
    
    setIsLoading(false);

    if (errorMessages.length > 0) {
      notifyError(`Deleted ${successCount} item(s) with ${errorMessages.length} error(s). See console for details.`);
    } else if (successCount > 0) {
      notifySuccess(`Successfully deleted ${successCount} item(s).`);
    }
  };

  // Improved check if navigation is needed after deletion
  const checkIfNavigationNeeded = (pathsToDelete: string[]): boolean => {
    // If we're deleting the current directory or any parent of current directory
    return pathsToDelete.some(itemPath => {
      // Check if we're deleting the current folder
      if (itemPath === currentPath) return true;
      
      // Check if we're deleting a parent folder of the current path
      if (currentPath.startsWith(itemPath + '/')) return true;
      
      return false;
    });
  };

  // Find a safe path to navigate to after deletion
  const findSafeNavigationPath = (pathsToDelete: string[]): string => {
    // If we're at root and deleting something, just stay at root
    if (currentPath === '') return '';
    
    // If we're not deleting the current path or its parent, stay here
    if (!checkIfNavigationNeeded(pathsToDelete)) return currentPath;
    
    // We need to find a suitable parent directory
    const pathParts = currentPath.split('/');
    
    // Try to go up one level at a time until we find a path that isn't being deleted
    for (let i = pathParts.length - 1; i >= 0; i--) {
      const testPath = pathParts.slice(0, i).join('/');
      
      // Check if this path is safe (not being deleted)
      if (!pathsToDelete.includes(testPath) && 
          !pathsToDelete.some(p => testPath.startsWith(p + '/'))) {
        return testPath;
      }
    }
    
    // If all else fails, go to root
    return '';
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

  // Modified to support both single-click row selection and checkbox multi-selection
  const handleItemSelect = (itemPath: string, isSelected: boolean, isCheckboxClick = false) => {
    // If we're in move mode and trying to deselect a marked item, cancel the move
    if (isMoveActive && !isSelected && itemsToMovePaths.includes(itemPath)) {
      console.log('[Select] Deselected item marked for move. Cancelling move.');
      handleCancelMove();
      return;
    }

    if (isCheckboxClick) {
      // Checkbox behavior - add/remove from current selection (multi-select)
      setSelectedPaths(prevSelected => {
        const newSelected = new Set(prevSelected);
        if (isSelected) {
          newSelected.add(itemPath);
          console.log('[handleItemSelect] Checkbox added to selection:', itemPath);
        } else {
          newSelected.delete(itemPath);
          console.log('[handleItemSelect] Checkbox removed from selection:', itemPath);
        }
        return newSelected;
      });
    } else {
      // Row click behavior - clear all and select only this item (single-select)
      if (isSelected) {
        // Clear previous selections and add only the new item
        setSelectedPaths(new Set([itemPath]));
        console.log('[handleItemSelect] Row click single select:', itemPath);
      } else {
        // If deselecting, simply remove this item from selection
        setSelectedPaths(prevSelected => {
          const newSelected = new Set(prevSelected);
          newSelected.delete(itemPath);
          console.log('[handleItemSelect] Row click deselected:', itemPath);
          return newSelected;
        });
      }
    }
  };
  // --- END Modified handleItemSelect ---

  // --- Add a helper for multi-selection (for future use with Shift/Ctrl key) ---
  const handleMultiItemSelect = (itemPath: string, isSelected: boolean) => {
    setSelectedPaths(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (isSelected) {
        newSelected.add(itemPath);
        console.log('[handleMultiItemSelect] Added to selection:', itemPath);
      } else {
        newSelected.delete(itemPath);
        console.log('[handleMultiItemSelect] Removed from selection:', itemPath);
      }
      return newSelected;
    });
  };
  // --- END Add helper ---

  // --- Modify Select All Handler to support single-select mode ---
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
  // --- END Modified handler ---

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
    
    // Find the items to be deleted
    const itemsToBeDeleted = items.filter(item => selectedPaths.has(item.path));
    setItemsToDelete(itemsToBeDeleted);
    setShowDeleteModal(true);
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

  // --- NEW Create Folder Handler with folderName parameter ---
  const handleCreateFolder = async (folderName: string) => {
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
  // --- END NEW ---

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
  const handleContextEditMetadata = async (props: any) => {
    const { itemPath, itemName, isDirectory } = props?.props || {};
    if (!itemPath || isDirectory) {
      console.warn('[ContextMenu Edit] Cannot edit metadata for directory or missing item data.');
      return;
    }

    const directoryPath = path.dirname(itemPath);
    const fileName = path.basename(itemPath);
    const directoryMetadata = await fileSystemService.getDirectoryMetadata(directoryPath);
    const fileMetadata = directoryMetadata?.files?.[fileName];

    if (!fileMetadata) {
      console.error(`[ContextMenu Edit] No metadata found for file: ${fileName} in directory: ${directoryPath}`);
      return;
    }

    // DO NOT PARSE - pass as-is
    setEditingMetadataItem({
      path: itemPath,
      name: itemName,
      metadata: fileMetadata,
    });
    setIsMetadataModalOpen(true);
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
    // If filter is active, sort the filtered items instead of all items
    const itemsToSort = isFilterActive ? filteredItems : items;
    // --- Add check for items array ---
    if (!Array.isArray(itemsToSort)) {
        console.error("[Sort] Items is not an array:", itemsToSort);
        return [];
    }
    // --- End check ---
    const sorted = [...itemsToSort].sort((a, b) => {
        // --- Add more robust checks for item validity ---
        const validA = a && typeof a.name === 'string' && typeof a.path === 'string';
        const validB = b && typeof a.name === 'string' && typeof a.path === 'string';

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
  }, [items, filteredItems, isFilterActive, sortKey, sortDirection]);
  // --- END Memoize ---


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
  // --- END NEW ---

  // Add this navigation function to BasicFileSystem component
  const navigateToPath = (path: string) => {
    console.log(`BasicFileSystem: BEFORE navigation - Current path: "${currentPath}"`);
    console.log(`BasicFileSystem: Attempting to navigate to: "${path}"`);

    // Ensure path is a string and normalize it
    const normalizedPath = String(path || '').trim();

    // Set the path directly to force a state change
    setCurrentPath(normalizedPath);

    // Log after state change (though React will batch this)
    console.log(`BasicFileSystem: AFTER navigation - New path should be: "${normalizedPath}"`);

    // Clear selections when changing directories
    setSelectedPaths(new Set());
  };

  // New helper function to check if a single selected item is a directory
  const getIsSelectedItemDirectory = () => {
    if (selectedPaths.size !== 1) return false;
    const selectedPath = Array.from(selectedPaths)[0];
    const selectedItem = items.find(item => item.path === selectedPath);
    
    return selectedItem?.isDirectory || false;
  };

  // Handle edit metadata from context menu - requires item parameter
  const handleEditMetadataForItem = (item: BlobItem) => {
    console.log('[Edit Metadata] Button clicked for:', item.path);
    
    // Skip if item is a directory (should be prevented in UI)
    if (item.isDirectory) {
      console.warn('[Edit Metadata] Cannot edit metadata for directory:', item.path);
      return;
    }

    // Parse metadata from the item
    const existingMetadata = parseBlobMetadataToFileMetadata(item.metadata || {});
    console.log('[Edit Metadata] Parsed metadata:', existingMetadata);
    
    // Set up the edit state (same as in context menu)
    const editState = {
      path: item.path,
      name: item.name,
      metadata: existingMetadata,
    };
    // Update state to open the modal
    setEditingMetadataItem(editState);
    setIsMetadataModalOpen(true);
  };

  // Handle edit metadata from toolbar - gets selected item from state
  const handleEditMetadataClick = async () => {
    if (selectedPaths.size !== 1) return;
    const selectedPath = Array.from(selectedPaths)[0];
    const selectedItem = items.find(item => item.path === selectedPath);
    if (!selectedItem || selectedItem.isDirectory) {
      console.warn('[Edit Metadata] Cannot edit metadata for directory or invalid item');
      return;
    }

    // Load metadata.json for the directory and get the correct file's metadata
    const directoryPath = path.dirname(selectedItem.path);
    const fileName = path.basename(selectedItem.path);
    const directoryMetadata = await fileSystemService.getDirectoryMetadata(directoryPath);
    const fileMetadata = directoryMetadata?.files?.[fileName];

    if (!fileMetadata) {
      console.error(`[Edit Metadata] No metadata found for file: ${fileName} in directory: ${directoryPath}`);
      return;
    }

    // DO NOT PARSE - pass as-is
    setEditingMetadataItem({
      path: selectedItem.path,
      name: selectedItem.name,
      metadata: fileMetadata,
    });
    setIsMetadataModalOpen(true);
  };

  // Handle metadata tag selection
  const handleMetadataTagSelect = (category: string, tag: string) => {
    setSelectedMetadataTags(prev => {
      // Check if the tag is already selected
      const isSelected = prev.some(item => item.category === category && item.tag === tag);
      
      if (isSelected) {
        // Remove the tag if already selected
        return prev.filter(item => !(item.category === category && item.tag === tag));
      } else {
        // Add the tag if not selected
        return [...prev, { category, tag }];
      }
    });
  };

  // Add a new useEffect to trigger metadata search when selected tags change
  useEffect(() => {
    // Only search if there are selected tags
    if (selectedMetadataTags.length > 0) {
      handleMetadataSearch();
    } else if (isFilterActive) {
      // Clear filter when no tags are selected
      setIsFilterActive(false);
      setFilteredItems([]);
    }
  }, [selectedMetadataTags, isMetadataSearchMode]);

  // Fix TypeScript errors in metadata search function
  const handleMetadataSearch = async () => {
    if (selectedMetadataTags.length === 0) {
      setIsFilterActive(false);
      setFilteredItems([]);
      return;
    }
    
    setIsSearching(true);
    setError(null);
    
    try {
      // Group selected tags by category to identify special cases
      const grouped = selectedMetadataTags.reduce((acc, tag) => {
        if (!acc[tag.category]) {
          acc[tag.category] = [];
        }
        acc[tag.category].push(tag);
        return acc;
      }, {} as Record<string, { category: string, tag: string }[]>);
      
      // Check if we have both primary theme and subthemes selected
      const hasPrimaryTheme = grouped['thematicfocus_primary']?.length > 0;
      const hasSubthemes = grouped['thematicfocus_subthemes']?.length > 0;
      
      // If only theme tags are selected, use OR logic regardless of global setting
      const isThemeOnlySearch = 
        selectedMetadataTags.every(tag => 
          tag.category === 'thematicfocus_primary' || 
          tag.category === 'thematicfocus_subthemes'
        );
      
      // Determine search logic to use - we may override it for theme-only searches
      const searchLogic: 'AND' | 'OR' = isThemeOnlySearch ? 'OR' : filterLogic;
      
      // For API calls - use the standard tags with appropriate logic
      const results = await fileSystemService.searchByMetadata(
        selectedMetadataTags,
        currentPath,
        isMetadataSearchMode,
        searchLogic
      );
      
      if (results && results.items) {
        setFilteredItems(results.items);
        setIsFilterActive(true);
        
        // Create a descriptive message about the search logic for display only
        let displayMessage = `Found ${results.totalItems} file(s) matching your filter criteria using ${searchLogic} logic`;
        
        // Add special note about theme/subtheme behavior if applicable
        if (hasPrimaryTheme && hasSubthemes) {
          displayMessage += " (with OR between themes and subthemes)";
        }
        
        notifyInfo(displayMessage);
      } else {
        // Handle empty results
        setFilteredItems([]);
        setIsFilterActive(true);
        notifyInfo(`No files found matching the selected filter criteria`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notifyError(`Search failed: ${message}`);
      // If search fails, keep showing unfiltered items
      setIsFilterActive(false);
      setFilteredItems([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Add this function to handle toggling deep search mode
  const handleToggleMetadataSearchMode = () => {
    setIsMetadataSearchMode(prevMode => !prevMode);
  };

  // Add this function to clear filters
  const handleClearFilters = () => {
    setSelectedMetadataTags([]);
    setIsFilterActive(false);
    setFilteredItems([]);
    
    // Also collapse all filter sections
    setExpandedSections([]);
  };

  // Add state for filter logic
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');

  // Handle filter logic change
  const handleFilterLogicChange = (logic: 'AND' | 'OR') => {
    setFilterLogic(logic);
    
    // If there are already selected tags, re-run the search with the new logic
    if (selectedMetadataTags.length > 0) {
      handleMetadataSearch();
    }
  };

  // Add these missing state variables for NLP search
  const [nlpQuery, setNlpQuery] = useState<string>('');
  const [isNlpSearching, setIsNlpSearching] = useState<boolean>(false);

  // Enhanced NLP search with OR logic as default and special theme handling
  const handleNlpSearch = async (query: string) => {
    if (!query.trim()) return;
    
    setIsNlpSearching(true);
    setError(null);
    setNlpQuery(query);
    
    try {
      console.log(`[NLP Search] Analyzing query: "${query}"`);
      
      // Normalize query for matching (lowercase)
      const normalizedQuery = query.toLowerCase();
      
      // Determine search logic (AND vs OR) based on query content
      // Look for explicit AND keywords instead of OR keywords
      const hasAndKeyword = /\b(and|both|all)\b/.test(normalizedQuery);
      
      // Choose logic based on query phrasing - default to OR unless AND is explicitly specified
      const detectedLogic: 'AND' | 'OR' = hasAndKeyword ? 'AND' : 'OR';
      console.log(`[NLP Search] Detected search logic: ${detectedLogic} (defaulting to OR unless AND specified)`);
      
      // Set the filter logic (will be used when the search is executed)
      setFilterLogic(detectedLogic);
      
      // Extract potential category/tag pairs from the query
      const exactMatches: { category: string, tag: string }[] = [];
      const partialMatches: { category: string, tag: string, matchedTerm: string }[] = [];
      
      // Map from metadataOptions fields to API filter fields
      const apiFieldMap: Record<string, string> = {
        'collection': 'collection',
        'jurisdictionType': 'jurisdiction_type',
        'jurisdictionName': 'jurisdiction_name',
        'thematicFocusPrimary': 'thematicfocus_primary',
        'thematicFocusSubthemes': 'thematicfocus_subthemes',
        'issuingAuthorityType': 'issuingauthority_type',
        'issuingAuthorityName': 'issuingauthority_name',
        'documentFunction': 'documentfunction',
        'version': 'version',
        'workflowStagePrimary': 'workflowstage_primary',
        'workflowStageSub': 'workflowstage_sub',
        'language': 'language',
        'accessLevel': 'accesslevel',
        'fileType': 'filetype',
        'license': 'license'
      };
      
      // Extract meaningful words from query (for partial matching)
      const queryWords = normalizedQuery
        .replace(/[.,;:!?()[\]{}'"]/g, ' ') // Remove punctuation
        .split(/\s+/)                        // Split by whitespace
        .filter(word => 
          word.length > 3 &&                  // Only consider words with 4+ characters to reduce noise
          !['with', 'from', 'about', 'that', 'this', 'these', 'those', 
            'have', 'what', 'when', 'where', 'which', 'there', 'their',
            'would', 'could', 'should', 'find', 'show', 'give', 'and', 
            'documents', 'files'].includes(word) // Skip common words
        );
      
      console.log(`[NLP Search] Extracted keywords for matching: ${queryWords.join(', ')}`);
      
      // Process metadata options to look for matches
      Object.entries(metadataOptionsData).forEach(([category, values]) => {
        // Get the API field name for this category
        const apiFieldName = apiFieldMap[category] || category.toLowerCase();
        
        // Process simple array values
        if (Array.isArray(values)) {
          values.forEach(tag => {
            // Create variations of the tag for matching (with and without underscores)
            const tagVariations = [
              tag.toLowerCase(),                     // Original with underscores: "south_africa"
              tag.toLowerCase().replace(/_/g, ' '),  // Spaces instead of underscores: "south africa"
              tag.toLowerCase().replace(/_/g, '')    // No spaces or underscores: "southafrica"
            ];
            
            // First, try exact matches (as complete words/phrases)
            const exactMatch = tagVariations.some(variant => {
              const wholeWordRegex = new RegExp(`\\b${variant}\\b`, 'i');
              return wholeWordRegex.test(normalizedQuery);
            });
            
            if (exactMatch) {
              exactMatches.push({ 
                category: apiFieldName, 
                tag: tag 
              });
              console.log(`[NLP Search] Exact match found for tag: ${apiFieldName}:${tag}`);
            } else {
              // If no exact match, try partial matching with keywords
              const tagWords = tag
                .toLowerCase()
                .replace(/_/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3); // Only consider significant words
              
              // Look for significant tag words in query words or vice versa
              for (const queryWord of queryWords) {
                // Match if query word is a significant part of a tag (e.g., "rights" in "Human_Rights")
                if (tagWords.some(tagWord => tagWord === queryWord || 
                                  (tagWord.length > 5 && tagWord.includes(queryWord) && queryWord.length > 4))) {
                  partialMatches.push({
                    category: apiFieldName,
                    tag: tag,
                    matchedTerm: queryWord
                  });
                  console.log(`[NLP Search] Partial match: "${queryWord}" found in tag "${tag}"`);
                  break; // Only count one match per tag
                }
                
                // Also match if tag is a significant part of query word
                // (e.g., "constitutional" matches "Constitutional_Drafting")
                if (tagVariations.some(variant => 
                    queryWord.includes(variant) && 
                    variant.length > 4 && 
                    queryWord.length > variant.length)) {
                  partialMatches.push({
                    category: apiFieldName,
                    tag: tag,
                    matchedTerm: queryWord
                  });
                  console.log(`[NLP Search] Partial match: tag "${tag}" found in query word "${queryWord}"`);
                  break;
                }
              }
            }
          });
        } 
        // Process nested object values (like jurisdictionName.Provincial)
        else if (typeof values === 'object') {
          // First check parent categories (e.g., "Provincial" in jurisdictionName)
          Object.entries(values).forEach(([parentValue, childValues]) => {
            // Check for exact matches with parent
            const parentVariations = [
              parentValue.toLowerCase(),
              parentValue.toLowerCase().replace(/_/g, ' '),
              parentValue.toLowerCase().replace(/_/g, '')
            ];
            
            const parentExactMatch = parentVariations.some(variant => {
              const wholeWordRegex = new RegExp(`\\b${variant}\\b`, 'i');
              return wholeWordRegex.test(normalizedQuery);
            });
            
            if (parentExactMatch) {
              exactMatches.push({
                category: apiFieldName,
                tag: parentValue
              });
              console.log(`[NLP Search] Exact match found for parent tag: ${apiFieldName}:${parentValue}`);
            } else {
              // Try partial match for parent values
              const parentWords = parentValue
                .toLowerCase()
                .replace(/_/g, ' ')
                .split(/\s+/)
                .filter(word => word.length > 3);
              
              for (const queryWord of queryWords) {
                if (parentWords.some(parentWord => parentWord === queryWord || 
                                    (parentWord.length > 5 && parentWord.includes(queryWord) && queryWord.length > 4))) {
                  partialMatches.push({
                    category: apiFieldName,
                    tag: parentValue,
                    matchedTerm: queryWord
                  });
                  console.log(`[NLP Search] Partial match: "${queryWord}" found in parent "${parentValue}"`);
                  break;
                }
                
                if (parentVariations.some(variant => 
                    queryWord.includes(variant) && 
                    variant.length > 4 && 
                    queryWord.length > variant.length)) {
                  partialMatches.push({
                    category: apiFieldName,
                    tag: parentValue,
                    matchedTerm: queryWord
                  });
                  console.log(`[NLP Search] Partial match: parent "${parentValue}" found in query word "${queryWord}"`);
                  break;
                }
              }
            }
            
            // Then check child values (e.g., "Gauteng" in jurisdictionName.Provincial)
            if (Array.isArray(childValues)) {
              childValues.forEach(childValue => {
                // Check for exact matches with child values
                const childVariations = [
                  childValue.toLowerCase(),
                  childValue.toLowerCase().replace(/_/g, ' '),
                  childValue.toLowerCase().replace(/_/g, '')
                ];
                
                const childExactMatch = childVariations.some(variant => {
                  const wholeWordRegex = new RegExp(`\\b${variant}\\b`, 'i');
                  return wholeWordRegex.test(normalizedQuery);
                });
                
                if (childExactMatch) {
                  exactMatches.push({
                    category: apiFieldName,
                    tag: childValue
                  });
                  console.log(`[NLP Search] Exact match found for child tag: ${apiFieldName}:${childValue}`);
                } else {
                  // Try partial match for child values
                  const childWords = childValue
                    .toLowerCase()
                    .replace(/_/g, ' ')
                    .split(/\s+/)
                    .filter(word => word.length > 3);
                  
                  for (const queryWord of queryWords) {
                    if (childWords.some(childWord => childWord === queryWord || 
                                      (childWord.length > 5 && childWord.includes(queryWord) && queryWord.length > 4))) {
                      partialMatches.push({
                        category: apiFieldName,
                        tag: childValue,
                        matchedTerm: queryWord
                      });
                      console.log(`[NLP Search] Partial match: "${queryWord}" found in child "${childValue}"`);
                      break;
                    }
                    
                    if (childVariations.some(variant => 
                        queryWord.includes(variant) && 
                        variant.length > 4 && 
                        queryWord.length > variant.length)) {
                      partialMatches.push({
                        category: apiFieldName,
                        tag: childValue,
                        matchedTerm: queryWord
                      });
                      console.log(`[NLP Search] Partial match: child "${childValue}" found in query word "${queryWord}"`);
                      break;
                    }
                  }
                }
              });
            }
          });
        }
      });
      
      // First prioritize exact matches
      if (exactMatches.length > 0) {
        setSelectedMetadataTags(exactMatches);
        notifyInfo(`Using ${detectedLogic} logic with ${exactMatches.length} exact matches: ${exactMatches.map(t => t.tag.replace(/_/g, ' ')).join(', ')}`);
      }
      // If no exact matches, try using partial matches (but only if we have meaningful ones)
      else if (partialMatches.length > 0) {
        // Remove duplicates by removing matching tags that point to the same category/tag
        const uniquePartialMatches = partialMatches.reduce((acc, match) => {
          const exists = acc.some(m => m.category === match.category && m.tag === match.tag);
          if (!exists) acc.push(match);
          return acc;
        }, [] as typeof partialMatches);
        
        // Only use top matches if we have many
        const usedMatches = uniquePartialMatches.length > 3 
          ? uniquePartialMatches.slice(0, 3) // Limit to 3 if we have many partial matches
          : uniquePartialMatches;
        
        // Convert to tag format expected by filter
        const tagsToUse = usedMatches.map(m => ({ category: m.category, tag: m.tag }));
        
        setSelectedMetadataTags(tagsToUse);
        
        // Create more informative message about partial matches
        const matchInfo = usedMatches.map(m => 
          `${m.tag.replace(/_/g, ' ')} (matched "${m.matchedTerm}")`
        ).join(', ');
        
        notifyInfo(`No exact matches found. Using ${detectedLogic} logic with ${usedMatches.length} partial matches: ${matchInfo}`);
      } else {
        // No matches at all
        notifyInfo(`No matching tags found in your query. Try including specific terms like "DA", "Gauteng", or "Land Reform".`);
      }
      
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      notifyError(`Search failed: ${message}`);
    } finally {
      setIsNlpSearching(false);
    }
  };

  // --- Fix JSX Structure ---
  return (
    <div className={styles.container}> {/* Main container with flex layout */}
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
      
      {/* Left sidebar with metadata filter */}
      <MetadataFilterBar
        onTagSelect={handleMetadataTagSelect}
        selectedTags={selectedMetadataTags}
        isMetadataFilterMode={isMetadataSearchMode}
        onToggleFilterMode={handleToggleMetadataSearchMode}
        onClearFilters={handleClearFilters}
        filterLogic={filterLogic}
        onFilterLogicChange={handleFilterLogicChange}
        expandedSections={expandedSections} // Pass the expanded sections
        onSectionToggle={(section: string) => {
          setExpandedSections((prev: string[]) => 
            prev.includes(section) 
              ? prev.filter((s: string) => s !== section)
              : [...prev, section]
          );
        }}
      />

      {/* Main content area */}
      <div className={styles.mainContent}>
       

        {/* --- Update Upload Section to use new trigger --- */}
        <NLPSearchBar 
          onSearch={handleNlpSearch}
          isSearching={isNlpSearching}
          onClearSearch={handleClearFilters} // Clear metadata tags when search is cleared
        />
        
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
          // Add new props with correct function that takes no parameters
          onEditMetadata={handleEditMetadataClick}
          isSelectedItemDirectory={getIsSelectedItemDirectory()}
          // Existing props
          isZipping={isZipping}
          isLoading={isLoading}
          currentPath={currentPath}
          onNavigateUp={navigateUp}
          onNavigateToPath={navigateToPath}
        />

        <StatusDisplay isLoading={isLoading} error={error} />

        {!isLoading && !error && (
          <FileListDisplay
            // --- Pass sorted items ---
            items={sortedItems}
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
            // --- FIX: Pass onEditMetadata prop ---
            onEditMetadata={handleEditMetadataForItem}
            // --- End Pass ---
            // --- Pass highlightedPath prop ---
            highlightedPath={highlightedPath}
            // --- End Pass ---
            isFilterActive={isFilterActive}
            isSearching={isSearching}
          />
        )}

        <FilePreviewModal
          item={previewItem}
          onClose={handleCloseModal}
        />

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
                // --- Pass handleSaveMetadata as onSave ---
                onSave={handleSaveMetadata}
                // --- End Pass ---
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
              // Fix typing for the disabled prop to match the expected HandlerParams interface
              disabled={(args) => args.props?.isDirectory === true}
          >
            Edit Metadata
          </Item>
          {/* --- END NEW --- */}
          <Item onClick={handleContextProperties}>
            Properties
          </Item>
        </Menu>
        {/* --- END FIX --- */}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className={styles.modalOverlay}>
            <div className={`${styles.modalContent} ${styles.deleteModal}`}>
              <button 
                className={styles.modalCloseButton} 
                onClick={() => setShowDeleteModal(false)}
                aria-label="Close"
              >
                ×
              </button>
              <h3>Confirm Deletion</h3>
              
              <div className={styles.deleteConfirmContent}>
                <p>Are you sure you want to delete the following {itemsToDelete.length} item(s)?</p>
                
                <div className={styles.deleteItemsList}>
                  {itemsToDelete.map(item => (
                    <div key={item.path} className={styles.deleteItemInfo}>
                      {item.isDirectory ? (
                        <FaFolder style={{ color: '#ffc107' }} />
                      ) : (
                        <FaFile style={{ color: '#17a2b8' }} />
                      )}
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
                
                {/* Show warning about current directory if needed */}
                {checkIfNavigationNeeded(itemsToDelete.map(item => item.path)) && (
                  <div className={styles.deleteWarning}>
                    <strong>Note:</strong> You are deleting the current directory or a parent folder.
                    You will be automatically navigated to a parent folder after deletion.
                  </div>
                )}
                
                <div className={styles.deleteWarning}>
                  This action cannot be undone. All data will be permanently deleted.
                </div>
              </div>
              
              <div className={styles.deleteActions}>
                <button 
                  className={styles.deleteCancelButton}
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className={styles.deleteConfirmButton}
                  onClick={executeDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
        
      </div> {/* End of main content div */}
    </div> /* End of container div */
  );
}); // Closing tag for the component function

// Set display name for the component
BasicFileSystem.displayName = 'BasicFileSystem';

export default BasicFileSystem;
