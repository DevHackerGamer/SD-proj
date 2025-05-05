import axios, { AxiosError } from 'axios';
// Ensure FileMetadata is included in the import
import type { BlobItem, FileMetadata, UploadOptions, BlobItemProperties } from './types'; // Add BlobItemProperties

export class FileSystemService {
  // Using relative path assuming Vite proxy handles '/api'
  private readonly apiBase = '/api/blob';

  async listFiles(directory: string = ''): Promise<BlobItem[]> {
    const endpoint = `${this.apiBase}/list`;
    console.log(`[Service] Fetching: ${endpoint}?path=${directory}`);
    try {
      const response = await axios.get(endpoint, {
        params: { path: directory },
        timeout: 15000 // Increased timeout slightly
      });
      return response.data;
    } catch (error: any) { // Type error as any
      console.error(`[Service] Error listing files for path "${directory}":`, error.message);
      this.handleApiError(error, 'list files'); // Use helper for consistent error handling
    }
  }

  // --- Modified uploadFile to accept metadata and targetPath ---
  // Adjust return type based on what the backend actually returns (e.g., { filePath: string })
  async uploadFile(file: File, metadata: FileMetadata, targetPath: string): Promise<{ filePath: string }> {
    const endpoint = `${this.apiBase}/upload`;
    console.log(`[Service] Uploading ${file.name} to path "${targetPath}" with metadata.`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // --- Add metadata and targetPath to FormData ---
      formData.append('metadata', JSON.stringify(metadata));
      formData.append('targetPath', targetPath); // Send the user-confirmed path
      // --- End Add ---

      const response = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Add progress tracking if needed
      });
      console.log('[Service] Upload successful:', response.data);
      // Assuming backend returns { filePath: '...' } as needed by BasicFileSystem
      return response.data;
    } catch (error: any) { // Type error as any
      console.error(`[Service] Error uploading file "${file.name}":`, error.message);
      // Use the existing error handler
      this.handleApiError(error, `upload file "${file.name}"`);
    }
  }
  // --- End Modified uploadFile ---

  async deleteItem(path: string): Promise<void> {
    console.log(`[Service] Deleting item at path: "${path}"`);
    if (!path) {
      console.error("[Service] Delete failed: Path is empty or undefined.");
      throw new Error("Item path cannot be empty for deletion.");
    }
    try {
      // --- Ensure path is encoded for URL query parameter ---
      const encodedPath = encodeURIComponent(path);
      await axios.delete(`${this.apiBase}/delete?path=${encodedPath}`);
      // --- End Change ---
      console.log(`[Service] Successfully deleted item: "${path}"`);
    } catch (error) {
      this.handleApiError(error, 'delete item');
      // Re-throw a more specific error or return a rejected promise
      throw new Error(`Failed to delete ${path}`);
    }
  }

  async getDownloadUrl(path: string): Promise<string> {
    console.log(`[Service] Getting download URL for path: "${path}"`);
    try {
      // Ensure the path is encoded properly for a URL query parameter
      const encodedPath = encodeURIComponent(path);
      const response = await axios.get<{ url: string }>(`${this.apiBase}/download-url?path=${encodedPath}`);
      console.log(`[Service] Received download URL for "${path}"`);
      return response.data.url;
    } catch (error) {
      this.handleApiError(error, 'get download URL');
      // Re-throw a more specific error or return a rejected promise
      throw new Error(`Failed to get download URL for ${path}`);
    }
  }

  async downloadZip(paths: string[]): Promise<void> {
    console.log(`[Service] Requesting ZIP download for ${paths.length} items.`);
    if (!paths || paths.length === 0) {
      console.warn("[Service] downloadZip called with no paths.");
      return; // Or throw error
    }
    try {
      const response = await axios.post(
        `${this.apiBase}/download-zip`,
        { paths }, // Send paths in the request body
        {
          responseType: 'blob', // Crucial: expect a binary blob response
        }
      );

      // Create a URL for the blob object
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // --- Refined Filename Extraction ---
      let filename = `download-${Date.now()}.zip`; // Fallback filename
      const contentDisposition = response.headers['content-disposition'];
      console.log('[Service] Received Content-Disposition header:', contentDisposition); // Log the header

      if (contentDisposition) {
        // Regex to find filename="..."; handles optional quotes
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
          console.log('[Service] Parsed filename from header:', filename);
        } else {
           // Attempt to handle filename*=UTF-8''... (more complex) - basic version
           const utf8FilenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
           if (utf8FilenameMatch && utf8FilenameMatch[1]) {
             try {
               filename = decodeURIComponent(utf8FilenameMatch[1]);
               console.log('[Service] Parsed UTF-8 filename from header:', filename);
             } catch (e) {
               console.error('[Service] Failed to decode UTF-8 filename, using fallback.', e);
             }
           } else {
             console.log('[Service] Could not parse filename from header, using fallback.');
           }
        }
      } else {
         console.log('[Service] No Content-Disposition header received, using fallback.');
      }
      console.log('[Service] Using filename:', filename);
      // --- End Refined Filename Extraction ---

      link.setAttribute('download', filename); // Set download attribute
      document.body.appendChild(link); // Append to body
      link.click(); // Programmatically click the link to trigger download

      // Clean up
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log(`[Service] ZIP download triggered as "${filename}".`);

    } catch (error) {
      // Need to handle potential blob error responses differently
      if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
        // Try to read the error message from the blob if it's JSON
        try {
          const errorJson = JSON.parse(await error.response.data.text());
          console.error("[Service] Server returned error in ZIP blob:", errorJson);
          this.handleApiError(error, 'download zip', errorJson); // Pass parsed error
        } catch (parseError) {
          console.error("[Service] Failed to parse error blob from server.");
          this.handleApiError(error, 'download zip'); // Fallback to default handling
        }
      } else {
        this.handleApiError(error, 'download zip'); // Default handling
      }
      throw new Error(`Failed to download ZIP.`);
    }
  }

  // Keep single move for drag-drop if needed
  async moveItem(sourcePath: string, destinationFolderPath: string): Promise<void> {
    const endpoint = `${this.apiBase}/move`;
    console.log(`[Service] Moving "${sourcePath}" to folder "${destinationFolderPath}"`);
    try {
      await axios.post(endpoint, { sourcePath, destinationFolderPath });
      console.log(`[Service] Successfully moved "${sourcePath}"`);
    } catch (error) {
      this.handleApiError(error, `move item "${sourcePath}"`);
      // Re-throw a more specific error
      throw new Error(`Failed to move ${sourcePath}`);
    }
  }

  // --- NEW Batch Move ---
  async moveItems(sourcePaths: string[], destinationFolderPath: string): Promise<any> { // Return type can be more specific
    const endpoint = `${this.apiBase}/move-batch`;
    console.log(`[Service] Moving ${sourcePaths.length} items to folder "${destinationFolderPath}"`);
    try {
      const response = await axios.post(endpoint, { sourcePaths, destinationFolderPath });
      console.log(`[Service] Batch move response:`, response.data);
      // Handle partial success (status 207) - maybe show errors to user
      if (response.status === 207 && response.data?.errors?.length > 0) {
          // Throw an error or return data indicating partial success
          throw new Error(`Move completed with errors: ${response.data.errors.join(', ')}`);
      }
      return response.data; // Contains success message
    } catch (error) {
      this.handleApiError(error, `move ${sourcePaths.length} items`);
      throw new Error(`Failed to move items.`); // Rethrow generic error
    }
  }
  // --- END Batch Move ---

  // --- NEW Batch Copy ---
  async copyItems(sourcePaths: string[], destinationFolderPath: string): Promise<any> {
    const endpoint = `${this.apiBase}/copy-batch`;
    console.log(`[Service] Copying ${sourcePaths.length} items to folder "${destinationFolderPath}"`);
     try {
      const response = await axios.post(endpoint, { sourcePaths, destinationFolderPath });
      console.log(`[Service] Batch copy response:`, response.data);
      if (response.status === 207 && response.data?.errors?.length > 0) {
          throw new Error(`Copy completed with errors: ${response.data.errors.join(', ')}`);
      }
      return response.data;
    } catch (error) {
      this.handleApiError(error, `copy ${sourcePaths.length} items`);
      throw new Error(`Failed to copy items.`);
    }
  }
  // --- END Batch Copy ---

  // --- NEW: Create Directory ---
  async createDirectory(folderPath: string): Promise<{ message: string; path: string }> {
    const endpoint = `${this.apiBase}/directory`;
    console.log(`[Service] Creating directory: "${folderPath}"`);
    try {
      const response = await axios.post(endpoint, { path: folderPath });
      console.log(`[Service] Successfully created directory: "${response.data.path}"`);
      return response.data;
    } catch (error) { // error is unknown
      this.handleApiError(error, `create directory "${folderPath}"`);
      // handleApiError now throws, so this line might not be reached,
      // but adding it for clarity in case handleApiError is changed later.
      throw new Error(`Failed to create directory ${folderPath}`);
    }
  }

  // --- NEW: Rename Item ---
  async renameItem(originalPath: string, newPath: string): Promise<{ message: string }> {
    const endpoint = `${this.apiBase}/rename`;
    console.log(`[Service] Renaming "${originalPath}" to "${newPath}"`);
    try {
      const response = await axios.post(endpoint, { originalPath, newPath });
      console.log(`[Service] Successfully renamed item.`);
      return response.data;
    } catch (error) { // error is unknown
      this.handleApiError(error, `rename "${originalPath}"`);
      throw new Error(`Failed to rename ${originalPath}`);
    }
  }

  // --- NEW: Get Item Properties ---
  async getItemProperties(itemPath: string): Promise<BlobItemProperties> {
    const endpoint = `${this.apiBase}/properties`;
    console.log(`[Service] Getting properties for: "${itemPath}"`);
    try {
      const encodedPath = encodeURIComponent(itemPath);
      const response = await axios.get<BlobItemProperties>(`${endpoint}?path=${encodedPath}`);
      console.log(`[Service] Received properties for "${itemPath}"`);
      return response.data;
    } catch (error) { // error is unknown
      this.handleApiError(error, `get properties for "${itemPath}"`);
      throw new Error(`Failed to get properties for ${itemPath}`);
    }
  }

  // Helper for consistent error handling - Revised Again
  private handleApiError(error: unknown, operation: string, parsedError?: any): never {
    let message = `Failed to ${operation}.`;

    if (parsedError?.message) {
        message = `Server Error: ${parsedError.message}`;
    } else if (axios.isAxiosError(error)) {
      // We know it's an AxiosError
      if (error.code === 'ECONNREFUSED') {
        message = 'Connection Refused: Cannot reach the backend server.';
      } else if (error.response) {
        console.error(`[Service] Server Error Response Data for "${operation}":`, error.response.data);
        const responseData = error.response.data;
        // Safely access potential error messages from response data
        const serverMsg = typeof responseData === 'object' && responseData !== null
                          ? responseData.message || responseData.error
                          : (typeof responseData === 'string' ? responseData : null);
        message = `Server Error (${error.response.status}): ${serverMsg || error.response.statusText}`;
      } else if (error.request) {
        message = 'Network Error: No response received from server.';
      } else {
        // Error setting up the request
        message = `Request Setup Error: ${error.message}`; // Safe: AxiosError has message
      }
    } else if (error instanceof Error) {
      // Handle standard JavaScript errors
      message = error.message; // Safe: Error has message
    } else {
       // Handle non-Error types (strings, numbers, etc.)
       message = `An unknown error occurred during ${operation}: ${String(error)}`;
    }

    console.error(`[Service] Original error object for "${operation}":`, error);
    throw new Error(message); // Always throw a standard Error
  }
}

export const fileSystemService = new FileSystemService();
