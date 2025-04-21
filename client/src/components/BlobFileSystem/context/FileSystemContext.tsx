import React, { createContext, useContext, useReducer, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { fileSystemManager } from '../services/FileSystemManager';
import type { FileSystemState, FileSystemItem, FileViewOptions } from '../types';
import type { UploadProgressInfo } from '../models';

// Initial state without mock data
const initialState: FileSystemState = {
  items: [],
  currentDirectory: '',
  selectedItems: [],
  isLoading: false,
  error: null
};

// Action types
type FileSystemAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ITEMS'; payload: FileSystemItem[] }
  | { type: 'SET_CURRENT_DIRECTORY'; payload: string }
  | { type: 'SELECT_ITEM'; payload: string }
  | { type: 'DESELECT_ITEM'; payload: string }
  | { type: 'SELECT_MULTIPLE_ITEMS'; payload: string[] }
  | { type: 'CLEAR_SELECTION' };

// Simplified reducer - no changes needed here
const fileSystemReducer = (state: FileSystemState, action: FileSystemAction): FileSystemState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_ITEMS':
      return { ...state, items: action.payload };
    case 'SET_CURRENT_DIRECTORY':
      return { ...state, currentDirectory: action.payload, selectedItems: [] };
    case 'SELECT_ITEM':
      return { 
        ...state, 
        selectedItems: state.selectedItems.includes(action.payload)
          ? state.selectedItems.filter(id => id !== action.payload)
          : [...state.selectedItems, action.payload]
      };
    case 'DESELECT_ITEM':
      return { 
        ...state, 
        selectedItems: state.selectedItems.filter(id => id !== action.payload) 
      };
    case 'SELECT_MULTIPLE_ITEMS':
      return { 
        ...state, 
        selectedItems: Array.from(new Set([...state.selectedItems, ...action.payload]))
      };
    case 'CLEAR_SELECTION':
      return { ...state, selectedItems: [] };
    default:
      return state;
  }
};

// Context type definition (simplified by using the manager)
interface FileSystemContextValue {
  items: FileSystemItem[];
  currentDirectory: string;
  selectedItems: string[];
  isLoading: boolean;
  error: string | null;
  loadFiles: (directory: string) => Promise<void>;
  navigateToDirectory: (directory: string) => void;
  navigateUp: () => void;
  selectItem: (itemId: string, multiSelect?: boolean) => void;
  clearSelection: () => void;
  createDirectory: (name: string) => Promise<void>;
  uploadFile: (file: File) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  renameItem: (itemId: string, newName: string) => Promise<void>;
  moveItems: (items: string[], destination: string) => Promise<any>;
  getDownloadUrl: (path: string) => Promise<string>;
  uploadProgress: UploadProgressInfo[];
}

// Create context
const FileSystemContext = createContext<FileSystemContextValue | undefined>(undefined);

// Provider component
interface FileSystemProviderProps {
  children: ReactNode;
}

export const FileSystemProvider: React.FC<FileSystemProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(fileSystemReducer, initialState);
  const [viewOptions, setViewOptions] = useState<FileViewOptions>({
    viewMode: 'grid',
    sortBy: 'name',
    sortDirection: 'asc',
    showHiddenFiles: false
  });
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo[]>([]);

  // Load files initially
  useEffect(() => {
    loadFiles('');
  }, []);

  // Load files using the manager
  const loadFiles = async (directory: string = '') => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      const items = await fileSystemManager.loadFiles(directory);
      console.log('Loaded items from Azure:', items);
      
      dispatch({ type: 'SET_ITEMS', payload: items });
      dispatch({ type: 'SET_CURRENT_DIRECTORY', payload: directory });
    } catch (error) {
      console.error('Error loading files from Azure:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load files';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      dispatch({ type: 'SET_ITEMS', payload: [] });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Selection and navigation methods remain the same
  const selectItem = (id: string, multiSelect: boolean = false) => {
    if (multiSelect) {
      if (state.selectedItems.includes(id)) {
        dispatch({ type: 'DESELECT_ITEM', payload: id });
      } else {
        dispatch({ type: 'SELECT_ITEM', payload: id });
      }
    } else {
      dispatch({ type: 'CLEAR_SELECTION' });
      dispatch({ type: 'SELECT_ITEM', payload: id });
    }
  };

  const clearSelection = () => {
    dispatch({ type: 'CLEAR_SELECTION' });
  };

  const navigateToDirectory = (directory: string) => {
    loadFiles(directory);
  };

  const navigateUp = () => {
    const parts = state.currentDirectory.split('/');
    parts.pop();
    const parentDir = parts.join('/');
    navigateToDirectory(parentDir);
  };

  // Use the manager for operations
  const createDirectory = async (name: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      await fileSystemManager.createDirectory(name, state.currentDirectory);
      
      // Reload files to get the updated directory
      await loadFiles(state.currentDirectory);
    } catch (error) {
      console.error('Error creating directory:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const uploadFile = async (file: File) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      await fileSystemManager.uploadFile(file, {
        directory: state.currentDirectory
      });
      
      // Reload files to show the new file
      await loadFiles(state.currentDirectory);
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const deleteItem = async (itemId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const item = state.items.find(i => i.id === itemId);
      if (!item) throw new Error('Item not found');
      
      await fileSystemManager.deleteItem(item.path);
      
      // Reload files to update the view
      await loadFiles(state.currentDirectory);
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const renameItem = async (itemId: string, newName: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const item = state.items.find(i => i.id === itemId);
      if (!item) throw new Error('Item not found');
      
      await fileSystemManager.renameItem(item.path, newName);
      
      // Reload files to update the view
      await loadFiles(state.currentDirectory);
    } catch (error) {
      console.error('Error renaming item:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const moveItems = async (itemPaths: string[], destination: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const result = await fileSystemManager.moveItems(itemPaths, destination);
      
      // Reload files to update the view
      await loadFiles(state.currentDirectory);
      
      return result;
    } catch (error) {
      console.error('Error moving items:', error);
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const getDownloadUrl = async (path: string): Promise<string> => {
    try {
      return await fileSystemManager.getDownloadUrl(path);
    } catch (error) {
      console.error('Error getting download URL:', error);
      throw error;
    }
  };

  return (
    <FileSystemContext.Provider
      value={{
        items: state.items,
        currentDirectory: state.currentDirectory,
        selectedItems: state.selectedItems,
        isLoading: state.isLoading,
        error: state.error,
        loadFiles,
        createDirectory,
        uploadFile,
        deleteItem,
        navigateToDirectory,
        navigateUp,
        renameItem,
        selectItem,
        clearSelection,
        moveItems,
        getDownloadUrl,
        uploadProgress
      }}
    >
      {children}
    </FileSystemContext.Provider>
  );
};

// Custom hook to use the context
export const useFileSystem = () => {
  const context = useContext(FileSystemContext);
  if (context === undefined) {
    throw new Error('useFileSystem must be used within a FileSystemProvider');
  }
  return context;
};
