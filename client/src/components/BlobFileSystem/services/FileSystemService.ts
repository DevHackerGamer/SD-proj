import axios, { AxiosError } from 'axios';
import type { BlobItem, FileMetadata, UploadOptions } from '../types';

export class FileSystemService {
  private readonly apiBase = '/api/blob';

  async listFiles(directory: string = ''): Promise<BlobItem[]> {
    const endpoint = `${this.apiBase}/list`;
    console.log(`Attempting to fetch files from: ${endpoint}?path=${directory}`);
    try {
      const response = await axios.get(endpoint, {
        params: { path: directory },
        timeout: 10000 
      });
      console.log(`Successfully fetched files for path: ${directory}`);
      return response.data;
    } catch (error) {
      console.error(`Error listing files for path "${directory}":`, error);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        // Specific check for connection refused
        if (axiosError.code === 'ECONNREFUSED') {
          console.error('Connection Refused: Cannot connect to the backend server at the specified address/port.');
          throw new Error('Connection Refused: Unable to reach the server. Please ensure the backend server is running and accessible.');
        }
        // Check for network errors (like DNS issues, timeouts)
        if (axiosError.request && !axiosError.response) {
           console.error('Network Error: No response received from the server.', axiosError.message);
           throw new Error(`Network Error: Could not get a response from the server. (${axiosError.message})`);
        }
        // Handle specific HTTP error codes
        if (axiosError.response) {
          console.error(`Server Error: Received status ${axiosError.response.status}`, axiosError.response.data);
          // Try to get a more specific message from the server response
          const serverMessage = axiosError.response.data?.message || axiosError.response.statusText;
          throw new Error(`Server Error: ${axiosError.response.status} - ${serverMessage}`);
        }
      }
      // Fallback for non-Axios errors or unexpected issues
      console.error('An unexpected error occurred:', error.message);
      throw new Error(`Failed to list files due to an unexpected error: ${error.message}`);
    }
  }

  // --- Temporarily comment out or remove other methods during debugging ---
  /*
  async createDirectory(path: string): Promise<BlobItem> { ... }
  async uploadFile(file: File, options?: UploadOptions): Promise<BlobItem> { ... }
  async uploadFileWithMetadata(...) : Promise<BlobItem> { ... }
  async ensureDirectoryStructure(path: string): Promise<void> { ... }
  async createMetadataJson(path: string, metadata: FileMetadata): Promise<BlobItem> { ... }
  async getItemMetadata(path: string): Promise<FileMetadata> { ... }
  async updateItemMetadata(path: string, metadata: FileMetadata): Promise<void> { ... }
  async deleteItem(path: string): Promise<void> { ... }
  async renameItem(oldPath: string, newPath: string): Promise<BlobItem> { ... }
  async moveItems(items: string[], targetDirectory: string): Promise<any> { ... }
  async getDownloadUrl(path: string): Promise<string> { ... }
  async downloadAsZip(items: string[]): Promise<string> { ... }
  */
  // --- End of temporarily removed methods ---
}

export const fileSystemService = new FileSystemService();
