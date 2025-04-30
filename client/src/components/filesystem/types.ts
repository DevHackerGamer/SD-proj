// Basic BlobItem structure - add more fields as needed from your original type
export interface BlobItem {
  id: string; // Usually the path
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number; // Size in bytes
  lastModified?: Date;
  contentType?: string;
  metadata?: Record<string, string>;
  url?: string; // Direct URL if available (e.g., for previews or downloads)
  // Add other fields as returned by your /list endpoint
}

// Basic UploadOptions
export interface UploadOptions {
  directory?: string; // Target directory path
  metadata?: Record<string, string>; // Add metadata option
  // Add onProgress etc. if needed later
}

// Define FileMetadata (can be expanded later)
export interface FileMetadata {
  title?: string;
  description?: string;
  // Add other common fields if known
}

// --- NEW: Type for Item Properties ---
export interface BlobItemProperties {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  createdOn?: Date;
  lastModified?: Date;
  contentType?: string;
  etag?: string;
  url?: string;
  metadata?: Record<string, string>;
  // Add other relevant properties you expect from the /properties endpoint
}
// --- END NEW ---

// --- NEW: Sort Types ---
export type SortKey = 'name' | 'size' | 'lastModified';
export type SortDirection = 'asc' | 'desc';
// --- END NEW ---

// --- NEW: Metadata structure ---
export interface FileMetadata {
  documentId?: string; // Add unique ID field
  documentType?: string; // Make optional
  level?: string; // Make optional
  language?: string; // Make optional
  tags?: string[]; // Keep as array, but could be empty
  topics?: string[]; // Keep as array, but could be empty
  accessLevel?: string; // Make optional
  fileType?: string; // Make optional
  country?: string; // Make optional
  jurisdiction?: string; // Make optional
  license?: string; // Make optional
  entitiesMentioned?: string[]; // Keep as array, but could be empty
  collection?: string; // Make optional
  description?: string; // Add optional description field
  // Add any other fields your modal uses, make them optional too
}
// --- END NEW ---
export type Node = {
  name: string;
  type: 'file' | 'dir';
  children?: Node[];
};