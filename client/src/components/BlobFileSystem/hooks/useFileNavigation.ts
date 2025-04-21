import { useState, useCallback, useEffect } from 'react';
import { useFileSystem } from '../context/FileSystemContext';

export const useFileNavigation = () => {
  const { 
    currentDirectory, 
    navigateToDirectory, 
    navigateUp,
    items 
  } = useFileSystem();
  
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);
  
  // Add current directory to history when it changes
  useEffect(() => {
    if (!currentDirectory) return;
    
    // Don't add if we're just navigating through history
    if (navigationHistory[currentHistoryIndex] === currentDirectory) return;
    
    // If we navigated from the middle of history, truncate the forward history
    const newHistory = navigationHistory.slice(0, currentHistoryIndex + 1);
    newHistory.push(currentDirectory);
    
    setNavigationHistory(newHistory);
    setCurrentHistoryIndex(newHistory.length - 1);
  }, [currentDirectory, navigationHistory, currentHistoryIndex]);
  
  // Get the path parts for breadcrumb
  const pathParts = currentDirectory 
    ? currentDirectory.split('/').filter(Boolean)
    : [];
  
  // Navigate to path with history tracking
  const navigateToPath = useCallback((path: string) => {
    navigateToDirectory(path);
  }, [navigateToDirectory]);
  
  // Navigate back in history
  const navigateBack = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const previousIndex = currentHistoryIndex - 1;
      const previousPath = navigationHistory[previousIndex];
      
      navigateToDirectory(previousPath);
      setCurrentHistoryIndex(previousIndex);
    }
  }, [currentHistoryIndex, navigationHistory, navigateToDirectory]);
  
  // Navigate forward in history
  const navigateForward = useCallback(() => {
    if (currentHistoryIndex < navigationHistory.length - 1) {
      const nextIndex = currentHistoryIndex + 1;
      const nextPath = navigationHistory[nextIndex];
      
      navigateToDirectory(nextPath);
      setCurrentHistoryIndex(nextIndex);
    }
  }, [currentHistoryIndex, navigationHistory, navigateToDirectory]);
  
  // Can navigate back/forward
  const canNavigateBack = currentHistoryIndex > 0;
  const canNavigateForward = currentHistoryIndex < navigationHistory.length - 1;
  
  return {
    currentDirectory,
    pathParts,
    navigateToPath,
    navigateUp,
    navigateBack,
    navigateForward,
    canNavigateBack,
    canNavigateForward,
    navigationHistory,
    currentHistoryIndex
  };
};
