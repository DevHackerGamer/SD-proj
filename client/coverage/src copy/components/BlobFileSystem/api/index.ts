import axios from 'axios';
import type { FileSystemItem, BlobItem, FileMetadata } from '../types';

// Set the API base URL based on the environment
export const API_BASE = process.env.NODE_ENV === 'production' 
  ? '/api/blob'
  : 'http://localhost:3000/api/blob'; // Adjust port if needed

// Export API-related constants and types
export const API_ENDPOINTS = {
  LIST: `${API_BASE}/list`,
  UPLOAD: `${API_BASE}/upload`,
  UPLOAD_WITH_METADATA: `${API_BASE}/upload-with-metadata`,
  CREATE_DIRECTORY: `${API_BASE}/directory`,
  DELETE: `${API_BASE}/delete`,
  DOWNLOAD_URL: `${API_BASE}/download-url`,
  GET_METADATA: `${API_BASE}/metadata`,
  UPDATE_METADATA: `${API_BASE}/metadata`
};

export interface UploadOptions {
  directory?: string;
  metadata?: FileMetadata;
  onProgress?: (progress: number) => void;
}

// Define the API methods that interact with the backend
export const blobApi = {
  // List files in a directory from Azure
  listFiles: async (directory: string = ''): Promise<BlobItem[]> => {
    try {
      const encodedDir = encodeURIComponent(directory);
      const url = `${API_ENDPOINTS.LIST}?path=${encodedDir}`;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  },

  // Upload file to Azure
  uploadFile: async (file: File, options?: UploadOptions): Promise<BlobItem> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (options?.directory) {
        formData.append('destination', options.directory);
      }
      
      if (options?.metadata) {
        formData.append('metadata', JSON.stringify(options.metadata));
      }
      
      const response = await axios.post(`${API_ENDPOINTS.UPLOAD}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: options?.onProgress 
          ? (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / (progressEvent.total || 100)
              );
              options.onProgress!(percentCompleted);
            }
          : undefined
      });
      
      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  // Delete item from Azure
  deleteItem: async (path: string): Promise<void> => {
    try {
      await axios.delete(`${API_ENDPOINTS.DELETE}`, { 
        data: { items: [path] } 
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  },

  // Create directory in Azure
  createDirectory: async (path: string): Promise<BlobItem> => {
    try {
      // Extract parent path and folder name
      const parts = path.split('/');
      const name = parts.pop() || '';
      const parentPath = parts.join('/');
      
      const response = await axios.post(`${API_ENDPOINTS.CREATE_DIRECTORY}`, { 
        path: parentPath, 
        name 
      });
      
      return response.data;
    } catch (error) {
      console.error('Error creating directory:', error);
      throw error;
    }
  },

  // Get download URL from Azure
  getDownloadUrl: async (path: string): Promise<string> => {
    try {
      const response = await axios.get(`${API_ENDPOINTS.DOWNLOAD_URL}`, { 
        params: { path } 
      });
      
      return response.data.downloadUrl || '#';
    } catch (error) {
      console.error('Error getting download URL:', error);
      throw error;
    }
  },

  // Update metadata in Azure
  updateMetadata: async (path: string, metadata: FileMetadata): Promise<void> => {
    try {
      await axios.post(`${API_ENDPOINTS.UPDATE_METADATA}`, { path, metadata });
    } catch (error) {
      console.error('Error updating metadata:', error);
      throw error;
    }
  },

  // Rename item in Azure
  renameItem: async (oldPath: string, newPath: string): Promise<BlobItem> => {
    try {
      const response = await axios.post(`${API_BASE}/rename`, { 
        path: oldPath, 
        newName: newPath.split('/').pop() 
      });
      
      return response.data;
    } catch (error) {
      console.error('Error renaming item:', error);
      throw error;
    }
  },

  // Move items in Azure
  moveItems: async (items: string[], targetDirectory: string): Promise<any> => {
    try {
      const response = await axios.post(`${API_BASE}/move`, { 
        items, 
        destination: targetDirectory 
      });
      
      return response.data;
    } catch (error) {
      console.error('Error moving items:', error);
      throw error;
    }
  }
};