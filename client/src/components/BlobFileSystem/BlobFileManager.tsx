import React, { useState, useEffect } from 'react';
import { FileSystemProvider, useFileSystem } from './context/FileSystemContext';
import {
  FileList,
  Toolbar, 
  Breadcrumb,
  ConnectionStatus,
  FilePreviewModal // Make sure FilePreviewModal is imported
} from './components'; 
import './styles.css';
import type { FileSystemItem } from './types';

// Direct fetch test function
const testDirectServerConnection = async () => {
  const serverUrl = 'http://localhost:3000/api/blob/test-connection'; // Direct URL to your server endpoint
  console.log(`[Direct Test] Attempting to fetch from ${serverUrl}`);
  try {
    const response = await fetch(serverUrl, { mode: 'cors' }); // Use fetch API directly
    console.log(`[Direct Test] Response Status: ${response.status}`);
    if (!response.ok) {
      console.error(`[Direct Test] Server responded with status: ${response.status}`);
      alert(`[Direct Test] Server connection failed! Status: ${response.status}. Check server logs.`);
    } else {
      console.log('[Direct Test] Server connection successful!');
      // You could show a temporary success message if needed
    }
  } catch (error) {
    console.error('[Direct Test] Fetch failed:', error);
    alert(`[Direct Test] Could not connect to server at ${serverUrl}. Is it running? Check CORS policy. Error: ${error.message}`);
  }
};

// Simplified Inner Component
const ArchiveManagerInner: React.FC = () => {
  const { 
    items, 
    currentDirectory, 
    navigateToDirectory,
    isLoading, 
    error,
    loadFiles,
    moveItems, // <-- Assume moveItems exists in the context
  } = useFileSystem();
  
  // State for the preview modal item
  const [previewItem, setPreviewItem] = useState<FileSystemItem | null>(null);
  // --- NEW: State for selected items ---
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  // --- END NEW ---
  // State for move operation feedback
  const [moveStatus, setMoveStatus] = useState<string>('');

  // Load files initially and when directory changes
  useEffect(() => {
    // Run the direct connection test on initial load
    testDirectServerConnection(); 
    
    loadFiles(currentDirectory);
  }, [currentDirectory, loadFiles]); // Reload when directory changes

  // Handle item double-click
  const handleItemDoubleClick = (item: FileSystemItem) => {
    // --- ADD LOGGING ---
    console.log('[handleItemDoubleClick] Triggered for item:', item.name, 'Is Directory:', item.isDirectory);
    // --- END LOGGING ---
    if (item.isDirectory) {
      console.log('[handleItemDoubleClick] Navigating to directory:', item.path);
      navigateToDirectory(item.path);
    } else {
      // --- ADD LOGGING ---
      console.log('[handleItemDoubleClick] Setting preview item:', item.name);
      // --- END LOGGING ---
      setPreviewItem(item); // Set state to open the modal
    }
  };

  // --- NEW: Handle item selection ---
  const handleItemSelect = (itemPath: string, event: React.MouseEvent) => {
    setSelectedPaths(prevSelected => {
      const newSelected = new Set(prevSelected);
      const isCtrlCmd = event.ctrlKey || event.metaKey; // Check for Ctrl (Windows/Linux) or Cmd (Mac)

      if (isCtrlCmd) {
        // Ctrl/Cmd + Click: Toggle selection
        if (newSelected.has(itemPath)) {
          newSelected.delete(itemPath);
          console.log('[handleItemSelect] Deselected (Ctrl/Cmd):', itemPath);
        } else {
          newSelected.add(itemPath);
          console.log('[handleItemSelect] Selected (Ctrl/Cmd):', itemPath);
        }
      } else {
        // Simple Click: Select only this item (or toggle if already selected)
        if (newSelected.has(itemPath) && newSelected.size === 1) {
           // If it's the only selected item, deselect it
           newSelected.delete(itemPath);
           console.log('[handleItemSelect] Deselected (Single):', itemPath);
        } else {
           // Otherwise, select only this one
           newSelected.clear();
           newSelected.add(itemPath);
           console.log('[handleItemSelect] Selected (Single):', itemPath);
        }
        // Note: Shift+Click range selection is not implemented here
      }
      return newSelected;
    });
  };
  // --- END NEW ---

  // --- ADD LOGGING FOR STATE CHANGE ---
  useEffect(() => {
    console.log('[State Update] previewItem changed:', previewItem);
  }, [previewItem]);
  // --- END LOGGING ---

  // Handler to close the modal
  const handleCloseModal = () => {
    console.log("[handleCloseModal] Closing modal.");
    setPreviewItem(null);
  };

  // Clear selection when navigating to a new directory
  useEffect(() => {
    setSelectedPaths(new Set());
  }, [currentDirectory]);

  // --- NEW: Handle Move Button Click ---
  const handleMoveClick = async () => {
    if (selectedPaths.size === 0) {
      alert('Please select items to move.');
      return;
    }

    const destination = prompt('Enter destination directory path (leave empty for root):', currentDirectory);
    // Basic validation: allow null (cancel) or empty string (root)
    if (destination === null) {
      console.log('Move cancelled by user.');
      return;
    }

    const pathsToMove = Array.from(selectedPaths);
    console.log(`[Move] Attempting to move ${pathsToMove.length} items to "${destination}"`, pathsToMove);
    setMoveStatus('Moving items...'); // Provide feedback

    try {
      // Call the context function, ensuring the payload matches the backend expectation
      // The context/service function should send: { sourcePaths: pathsToMove, destinationDirectory: destination }
      await moveItems(pathsToMove, destination);
      setMoveStatus(`Successfully moved ${pathsToMove.length} items.`);
      setSelectedPaths(new Set()); // Clear selection on success
      // Optionally reload files: loadFiles(currentDirectory);
    } catch (err: any) {
      console.error('[Move] Failed:', err);
      setMoveStatus(`Move failed: ${err.message || 'Unknown error'}`);
      // Don't clear selection on error
    }
  };
  // --- END NEW ---

  // Basic rendering logic
  const renderContent = () => {
    if (isLoading) return <div className="loading">Loading...</div>;
    // Display error prominently
    if (error) return <div className="error-message">Error: {error}</div>;
    if (!items || items.length === 0) return <div className="empty-directory">Directory is empty or failed to load.</div>;
    
    // Default to FileList view
    return (
      <FileList
        onItemDoubleClick={handleItemDoubleClick}
        // --- Pass selection state and handler ---
        selectedPaths={selectedPaths}
        onItemSelect={handleItemSelect}
        // --- End Pass ---
      />
    );
  };

  return (
    <div className="atom-archive-system simplified">
      <ConnectionStatus /> 
      <div className="atom-header">
        <h1>File Browser</h1> 
        {/* --- NEW: Add Move Button --- */}
        <button
          onClick={handleMoveClick}
          disabled={selectedPaths.size === 0 || isLoading}
          className="move-button" // Add styling as needed
        >
          Move Selected ({selectedPaths.size})
        </button>
        {/* Display move status */}
        {moveStatus && <span className="move-status"> Status: {moveStatus}</span>}
        {/* --- END NEW --- */}
      </div>
      
      <div className="atom-main-container">
        {/* Removed Sidebar */}
        <div className="atom-content-area">
          {/* Optional: Simplified Toolbar if needed */}
          {/* <Toolbar /> */} 
          
          <Breadcrumb 
            currentDirectory={currentDirectory} 
            onNavigate={navigateToDirectory}
            // Removed viewMode props
          />
          
          {/* Removed MultiActionToolbar */}
          
          <div className="atom-results-container">
            {renderContent()}
          </div>
        </div>
      </div>
        
      {/* Render the modal conditionally */}
      <FilePreviewModal
        item={previewItem}
        onClose={handleCloseModal}
      />
    </div>
  );
};

// Main exported component with provider
const BlobFileManager: React.FC = () => (
  <FileSystemProvider>
    <ArchiveManagerInner />
  </FileSystemProvider>
);

export default BlobFileManager;vvvvv
