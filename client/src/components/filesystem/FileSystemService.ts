import axios, { AxiosError } from 'axios';
import type { BlobItem, BlobItemProperties, FileMetadata } from './types'; // Ensure FileMetadata is imported
import path from 'path-browserify'; // Import path

// Define the expected structure of metadata.json content
interface DirectoryMetadata {
  files: Record<string, FileMetadata>; // Assuming metadata stored here is already in FileMetadata format
  folders: Record<string, any>; // Define folder structure if needed, using 'any' for now
}

// --- NEW: Define structure for metadata_fields.json ---
export interface MetadataFieldOption {
  [key: string]: string[] | Record<string, string[]>;
}

export interface MetadataFieldConfig {
  type: 'select' | 'hierarchical-select' | 'multi-select-checkbox' | 'hierarchical-input' | 'comma-input' | 'date' | 'textarea' | 'filename' | 'text'; // Add more types as needed
  label: string;
  options?: string[] | MetadataFieldOption;
  dependsOn?: string;
  allowManualEntry?: boolean;
  required?: boolean;
}

export interface MetadataCategoryConfig {
  id: string;
  title: string;
  fields: string[];
  description?: string;
}

export interface MetadataFieldsFile {
  categories: MetadataCategoryConfig[];
  fields: Record<string, MetadataFieldConfig>;
}
// --- END NEW ---

export class FileSystemService {
  // Using relative path assuming Vite proxy handles '/api'
  private readonly apiBase = '/api/blob';
// --- NEW: Cache for metadata config ---
  private metadataConfigCache: MetadataFieldsFile | null = null;
  private metadataConfigPromise: Promise<MetadataFieldsFile> | null = null;
  // --- END NEW ---

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

  // --- NEW: Get Metadata JSON Content ---
  async getMetadataJson(metadataPath: string): Promise<any> { // Return type is 'any' for now, refine if needed
    const endpoint = `${this.apiBase}/metadata`;
    console.log(`[Service] Getting metadata content for: "${metadataPath}"`);
    try {
      const encodedPath = encodeURIComponent(metadataPath);
      const response = await axios.get<any>(`${endpoint}?path=${encodedPath}`);
      console.log(`[Service] Received metadata content for "${metadataPath}"`);
      return response.data; // The backend should return the parsed JSON object
    } catch (error) { // error is unknown
      this.handleApiError(error, `get metadata content for "${metadataPath}"`);
      throw new Error(`Failed to get metadata content for ${metadataPath}`);
    }
  }
  // --- END NEW ---

  // --- NEW: Get Directory Metadata (metadata.json) ---
  async getDirectoryMetadata(directoryPath: string): Promise<DirectoryMetadata | null> {
    // Construct the path to metadata.json, ensuring forward slashes and handling root
    const metadataJsonPath = path.join(directoryPath || '', 'metadata.json');
    console.log(`[Service] Attempting to fetch directory metadata from: "${metadataJsonPath}"`);
    const endpoint = `${this.apiBase}/download`; // Use the existing download endpoint

    try {
      // Use getDownloadUrl to get a SAS URL for metadata.json
      const sasUrl = await this.getDownloadUrl(metadataJsonPath);

      // Fetch the content using the SAS URL
      const response = await axios.get<DirectoryMetadata>(sasUrl, {
        // Important: Tell axios to expect JSON, but handle potential non-JSON responses
        responseType: 'json',
        // Validate status to handle 404 gracefully if SAS URL is generated but file deleted
        validateStatus: function (status) {
          return status >= 200 && status < 300 || status === 404;
        },
        // Prevent Axios from automatically parsing non-JSON responses as errors
        transformResponse: [(data) => {
            // If data is already an object (likely parsed JSON), return it
            if (typeof data === 'object' && data !== null) {
                return data;
            }
            // If data is a string, try parsing it
            if (typeof data === 'string') {
                try {
                    return JSON.parse(data);
                } catch (e) {
                    // If parsing fails, return null or throw a specific error
                    console.warn(`[Service] Failed to parse metadata.json content for "${metadataJsonPath}"`);
                    return null;
                }
            }
            // Return null for unexpected data types
            return null;
        }]
      });

      if (response.status === 404 || response.data === null) {
        console.log(`[Service] metadata.json not found or invalid content at "${metadataJsonPath}".`);
        return null;
      }

      // Basic validation of the structure
      if (typeof response.data === 'object' && response.data !== null) {
         // Ensure files and folders properties exist, even if empty
         const validatedData: DirectoryMetadata = {
             files: response.data.files || {},
             folders: response.data.folders || {},
         };
         console.log(`[Service] Successfully fetched and parsed metadata.json for "${directoryPath}".`);
         return validatedData;
      } else {
         console.warn(`[Service] Fetched data for metadata.json is not a valid object for "${metadataJsonPath}".`);
         return null;
      }

    } catch (error) {
      // Check specifically for 404 errors from getDownloadUrl (meaning metadata.json doesn't exist)
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log(`[Service] metadata.json not found at "${metadataJsonPath}" (via getDownloadUrl).`);
        return null; // File not found is not necessarily an error in this context
      }
      // Log other errors
      this.handleApiError(error, `fetch directory metadata for "${directoryPath}"`);
      return null; // Return null on other errors
    }
  }
  // --- END NEW ---

  // --- NEW: Update Blob Metadata ---
  async updateBlobMetadata(blobPath: string, metadata: FileMetadata): Promise<{ message: string }> {
    const endpoint = `${this.apiBase}/update-metadata`;
    console.log(`[Service] Updating metadata for: "${blobPath}"`);
    try {
      // Backend expects { blobPath: string, metadata: string }
      const response = await axios.put<{ message: string }>(endpoint, {
        blobPath: blobPath,
        metadata: JSON.stringify(metadata) // Send metadata as a JSON string
      });
      console.log(`[Service] Metadata update successful for "${blobPath}":`, response.data.message);
      return response.data;
    } catch (error) { // error is unknown
      this.handleApiError(error, `update metadata for "${blobPath}"`);
      throw new Error(`Failed to update metadata for ${blobPath}`);
    }
  }
  // --- END NEW ---

  // --- NEW: Get Metadata Fields Configuration ---
  // Accept configFileName as parameter, default to 'metadata_fields.json'
  async getMetadataFieldsConfig(configFileName: string = 'metadata_fields.json'): Promise<MetadataFieldsFile> {
    console.log('[Service] Getting metadata fields configuration...');

    // Return from cache if available
    if (this.metadataConfigCache) {
      console.log('[Service] Returning cached metadata config.');
      return this.metadataConfigCache;
    }

    // Return existing promise if fetch is already in progress
    if (this.metadataConfigPromise) {
      console.log('[Service] Fetch already in progress, returning existing promise.');
      return this.metadataConfigPromise;
    }

    // Fetch from server
    this.metadataConfigPromise = (async () => {
      try {
        // Option 1: Use a dedicated endpoint (Recommended)
        // const response = await axios.get<MetadataFieldsFile>(`${this.apiBase}/metadata-config`);
        // this.metadataConfigCache = response.data;

        // Option 2: Fetch directly using download URL (Simpler for now)
        console.log(`[Service] Fetching ${configFileName} using download URL.`);
        const sasUrl = await this.getDownloadUrl(configFileName); // Assumes config is at root
        const response = await axios.get(sasUrl, { responseType: 'json' }); // Expect JSON directly

        if (typeof response.data !== 'object' || response.data === null) {
          throw new Error('Invalid JSON received for metadata configuration.');
        }

        // Basic validation (can be expanded)
        if (!response.data.categories || !response.data.fields) {
            throw new Error('Metadata configuration is missing required "categories" or "fields" properties.');
        }

        this.metadataConfigCache = response.data as MetadataFieldsFile;
        console.log('[Service] Successfully fetched and cached metadata config.');
        return this.metadataConfigCache;

      } catch (error) {
        console.error('[Service] Failed to fetch or parse metadata configuration:', error);
        // Clear promise to allow retrying
        this.metadataConfigPromise = null;
        // Re-throw a more specific error
        throw new Error(`Failed to load metadata configuration (${configFileName}): ${error instanceof Error ? error.message : String(error)}`);
      } finally {
          // Clear the promise once resolved or rejected, unless caching is desired for the promise itself
          // this.metadataConfigPromise = null; // Keep it null only on error if you want to retry
      }
    })();

    return this.metadataConfigPromise;
  }
  // --- END NEW ---

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

  // Add a new method to search files by metadata
  async searchFilesByMetadata(tags: { category: string, tag: string }[]): Promise<BlobItem[]> {
    // Prepare the search parameters
    const searchParams = new URLSearchParams();
    
    // Add each tag as a search parameter
    tags.forEach(({ category, tag }) => {
      searchParams.append('tags', `${category}:${tag}`);
    });
    
    try {
      // Make API call to search endpoint
      const response = await axios.get(`/api/search?${searchParams.toString()}`);
      
      // Transform API response into BlobItem[] format
      return response.data.map((item: any) => ({
        name: item.name,
        path: item.path,
        isDirectory: false, // Search results are always files
        size: item.size,
        lastModified: item.lastModified,
        metadata: item.metadata || {},
        contentType: item.contentType || 'application/octet-stream'
      }));
    } catch (error) {
      console.error('Error searching files by metadata:', error);
      throw new Error('Failed to search files by metadata');
    }
  }

  /**
   * Search for files by metadata tags
   * @param tags Array of category-tag pairs to filter by
   * @param currentPath Current directory path for local filtering
   * @param deepSearch Whether to search across all directories
   * @param filterLogic Logic to apply for filtering ('AND' or 'OR')
   * @returns Search results containing matching items
   */
  async searchByMetadata(
    tags: { category: string, tag: string }[],
    currentPath: string = '',
    deepSearch: boolean = false,
    filterLogic: 'AND' | 'OR' = 'AND'
  ): Promise<{
    items: BlobItem[];
    totalItems: number;
    message?: string;
  }> {
    console.log(`[Service] Searching by metadata: ${tags.length} tags, path: "${currentPath}", deep search: ${deepSearch}, filter logic: ${filterLogic}`);
    
    // Preprocess tags to normalize categories for search
    const processedTags = tags.map(({ category, tag }) => {
      // Convert spaces in category to camelCase or snake_case format
      const processedCategory = category.replace(/\s+(\w)/g, (_, letter) => letter.toUpperCase());
      return {
        category: processedCategory,
        tag: tag  // The server will handle tag normalization
      };
    });
    
    try {
      const response = await axios.post(`${this.apiBase}/search`, {
        tags: processedTags,
        currentPath,
        deepSearch,
        filterLogic // Add this parameter
      });
      
      console.log(`[Service] Search results: ${response.data.totalItems} files found`);
      return response.data;
    } catch (error) {
      console.error('Error searching by metadata:', error);
      this.handleApiError(error, 'search by metadata');
      throw new Error('Failed to search by metadata');
    }
  }

  /**
   * Analyze a document to extract description and tags
   * @param file The file to analyze
   * @returns Analysis results with description and keywords
   */
  async analyzeDocument(file: File): Promise<{
    success: boolean;
    description: string;
    keywords: string[];
    error?: string;
  }> {
    const endpoint = '/api/document-analysis/analyze';
    console.log(`[FileSystemService] Starting document analysis for: ${file.name} (${file.type}, size: ${file.size} bytes)`);
    
    try {
      // Check if we should use a mock response for testing - using import.meta.env instead of process.env
      if (import.meta.env.VITE_USE_MOCK_ANALYSIS === 'true') {
        console.log(`[FileSystemService] Using mock analysis response for ${file.name}`);
        return {
          success: true,
          description: `This is a mock description for ${file.name}. It contains sample content that would typically be generated by analyzing the document contents.`,
          keywords: ['mock', 'sample', 'test', file.name.split('.')[0]]
        };
      }
      
      // Check if file is PDF and handle potential extraction issues
      if (file.type === 'application/pdf') {
        console.log(`[FileSystemService] Processing PDF file, size: ${file.size} bytes`);
      }
      
      const formData = new FormData();
      formData.append('file', file);
      
      // Add an explicit option for text sanitization
      formData.append('sanitizeText', 'true');
      
      console.log(`[FileSystemService] Sending analysis request to API for ${file.name}`);
      
      try {
        const response = await axios.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000, // Extended timeout for PDF processing
        });
        
        console.log(`[FileSystemService] Analysis response received for ${file.name}`);
        
        // Enhanced PDF binary content detection
        if (response.data && typeof response.data.description === 'string') {
          const sampleText = response.data.description.substring(0, 200); // Check a larger sample
          console.log(`[FileSystemService] Sample of extracted text: "${sampleText}"`);
          
          // Check for common PDF binary markers and patterns
          const hasPdfBinaryMarkers = (
            sampleText.includes('<</Length') || 
            sampleText.includes('/Filter/FlateDecode') ||
            sampleText.includes('stream') || 
            sampleText.includes('endstream') ||
            sampleText.includes('xref') ||
            /<<\/[A-Z][a-z]+\s+\d+\s+\d+\s+R/.test(sampleText) // PDF object reference pattern
          );
          
          // Check ratio of non-printable characters
          const nonPrintableCount = (sampleText.match(/[^\x20-\x7E\r\n\t]/g) || []).length;
          const nonPrintableRatio = nonPrintableCount / sampleText.length;
          
          console.log(`[FileSystemService] PDF binary detection results:`, {
            hasPdfBinaryMarkers,
            nonPrintableRatio: nonPrintableRatio.toFixed(2),
            nonPrintableCount
          });
          
          if (hasPdfBinaryMarkers || nonPrintableRatio > 0.15) { // Lower threshold and check for PDF markers
            console.warn(`[FileSystemService] PDF binary content detected in extracted text`);
            return {
              success: true,
              description: `This document appears to be a PDF file named ${file.name}. It may be encrypted, password-protected, or contain only scanned images without OCR text. The text content could not be properly extracted.`,
              keywords: [file.name.split('.')[0], 'pdf', 'document']
            };
          }
        }
        
        if (response.data && response.data.success) {
          return {
            success: true,
            description: response.data.description || 'No description generated.',
            keywords: response.data.keywords || []
          };
        } else {
          console.warn(`[FileSystemService] Analysis response indicates failure:`, response.data?.error || 'Unknown error');
          return {
            success: false,
            error: response.data?.error || 'Failed to analyze document',
            description: '',
            keywords: []
          };
        }
      } catch (apiError: any) {
        // Handle specific API errors
        console.error(`[FileSystemService] API error analyzing document ${file.name}:`, apiError);
        
        if (apiError.response?.status === 422) {
          return {
            success: false,
            error: 'This PDF file appears to be encrypted or contains no extractable text.',
            description: '',
            keywords: []
          };
        }
        
        // Rethrow to be handled by outer catch
        throw apiError;
      }
    } catch (error: any) {
      console.error(`[FileSystemService] Error analyzing document ${file.name}:`, error);
      
      let errorMessage = 'Failed to analyze document';
      
      // Check for common PDF issues
      if (file.type === 'application/pdf') {
        if (error.message?.includes('decrypt') || error.message?.includes('encrypted')) {
          errorMessage = 'This PDF file appears to be encrypted. Please provide an unencrypted version.';
        } else if (error.message?.includes('encoding') || error.message?.includes('character')) {
          errorMessage = 'The text in this PDF could not be properly extracted due to encoding issues.';
        } else {
          errorMessage = 'There was an issue extracting text from this PDF file.';
        }
      }
      
      // Enhanced fallback for PDF files
      if (file.type === 'application/pdf') {
        console.log(`[FileSystemService] Generating PDF-specific fallback for ${file.name}`);
        return {
          success: true,
          description: `This document appears to be a PDF file named ${file.name}. It may be encrypted, password-protected, or contain only scanned images without OCR text. The text content could not be properly extracted for analysis.`,
          keywords: [file.name.split('.')[0], 'pdf', 'document']
        };
      }
      
      // For better UX, provide a meaningful fallback for other file types
      console.log(`[FileSystemService] Generating fallback response for ${file.name}`);
      return {
        success: true,
        description: `This document appears to be a ${file.type} file named ${file.name}. No detailed analysis was performed due to extraction issues with the file content.`,
        keywords: [file.name.split('.')[0], file.type.split('/')[1]]
      };
      
      /* Uncomment this to return an error instead of a fallback
      return {
        success: false,
        error: error.response?.data?.error || errorMessage,
        description: '',
        keywords: []
      };
      */
    }
  }
}

export const fileSystemService = new FileSystemService();