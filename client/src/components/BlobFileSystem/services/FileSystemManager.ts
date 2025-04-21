import { fileSystemService } from './FileSystemService';
import type { FileSystemItem } from '../types';
import type { UploadOptions } from '../models';

export class FileSystemManager {
  async loadFiles(directory: string): Promise<FileSystemItem[]> {
    return fileSystemService.listFiles(directory);
  }
  
  async createDirectory(name: string, parentDirectory: string): Promise<FileSystemItem> {
    const path = parentDirectory ? `${parentDirectory}/${name}` : name;
    // Create directory structure
    await fileSystemService.ensureDirectoryStructure(path);
    
    // For now, just create the directory and return a mock item
    // In a real implementation, this would create and return the actual directory
    const directoryPath = parentDirectory ? `${parentDirectory}/${name}` : name;
    
    // In case createDirectory doesn't exist, we'll create a workaround using ensureDirectoryStructure
    try {
      // Try to use createDirectory if it exists
      return await fileSystemService.createDirectory(path);
    } catch (error) {
      // Fallback to using API directly
      console.log('Falling back to using ensureDirectoryStructure for directory creation');
      await fileSystemService.ensureDirectoryStructure(path);
      return {
        id: directoryPath,
        name: name,
        path: directoryPath,
        isDirectory: true,
        parentPath: parentDirectory || undefined
      };
    }
  }
  
  async uploadFile(file: File, options?: UploadOptions): Promise<FileSystemItem> {
    let targetPath = file.name;
    
    if (options?.directory) {
      // Construct the target path with the directory
      targetPath = options.directory;
      if (targetPath && !targetPath.endsWith('/')) {
        targetPath += '/';
      }
      targetPath += file.name;
    }
    
    // Try to use uploadFileWithMetadata if it exists
    try {
      return await fileSystemService.uploadFileWithMetadata(
        file, 
        targetPath, 
        options?.metadata || {}, 
        { onProgress: options?.onProgress }
      );
    } catch (error) {
      // If the method doesn't exist, try a simpler approach
      console.error('Error using uploadFileWithMetadata, falling back:', error);
      
      // Create FormData manually
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetPath', targetPath);
      
      if (options?.metadata) {
        formData.append('metadata', JSON.stringify(options.metadata));
      }
      
      // Use basic fetch API as fallback
      const response = await fetch('/api/blob/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      return await response.json();
    }
  }
  
  async deleteItem(path: string): Promise<void> {
    try {
      return await fileSystemService.deleteItem(path);
    } catch (error) {
      // Fallback to using fetch API directly
      console.error('Error using deleteItem method:', error);
      
      const response = await fetch('/api/blob/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [path] })
      });
      
      if (!response.ok) {
        throw new Error(`Delete failed: ${response.statusText}`);
      }
    }
  }
  
  async renameItem(oldPath: string, newName: string): Promise<FileSystemItem> {
    try {
      return await fileSystemService.renameItem(oldPath, newName);
    } catch (error) {
      // Fallback to using fetch API directly
      console.error('Error using renameItem method:', error);
      
      // Extract parent path
      const parts = oldPath.split('/');
      parts.pop();
      const parentPath = parts.join('/');
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      
      const response = await fetch('/api/blob/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: oldPath, newName })
      });
      
      if (!response.ok) {
        throw new Error(`Rename failed: ${response.statusText}`);
      }
      
      return await response.json();
    }
  }
  
  async moveItems(itemPaths: string[], destination: string): Promise<any> {
    try {
      return await fileSystemService.moveItems(itemPaths, destination);
    } catch (error) {
      // Fallback to using fetch API directly
      console.error('Error using moveItems method:', error);
      
      const response = await fetch('/api/blob/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemPaths, destination })
      });
      
      if (!response.ok) {
        throw new Error(`Move failed: ${response.statusText}`);
      }
      
      return await response.json();
    }
  }
  
  async getDownloadUrl(path: string): Promise<string> {
    try {
      return await fileSystemService.getDownloadUrl(path);
    } catch (error) {
      // Fallback to using fetch API directly
      console.error('Error using getDownloadUrl method:', error);
      
      const response = await fetch(`/api/blob/download-url?path=${encodeURIComponent(path)}`);
      
      if (!response.ok) {
        throw new Error(`Getting download URL failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.downloadUrl || '#';
    }
  }
  
  async updateMetadata(path: string, metadata: any): Promise<void> {
    try {
      return await fileSystemService.updateItemMetadata(path, metadata);
    } catch (error) {
      // Fallback to using fetch API directly
      console.error('Error using updateItemMetadata method:', error);
      
      const response = await fetch('/api/blob/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, metadata })
      });
      
      if (!response.ok) {
        throw new Error(`Updating metadata failed: ${response.statusText}`);
      }
    }
  }
}

export const fileSystemManager = new FileSystemManager();
