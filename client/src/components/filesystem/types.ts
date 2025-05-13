// Basic BlobItem structure - add more fields as needed from your original type
export interface BlobItem {
  id: string; // Unique identifier for this specific blob instance
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number; // Size in bytes
  lastModified?: Date;
  contentType?: string;
  metadata?: Record<string, string>; // Raw metadata from Azure
  url?: string; // Optional SAS URL
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
  createdOn?: Date; // Add createdOn
  lastModified?: Date;
  contentType?: string;
  etag?: string; // Add ETag
  url?: string;
  metadata?: Record<string, string>; // Raw metadata
  // Add other relevant properties you expect from the /properties endpoint
}
// --- END NEW ---

// --- NEW: Sort Types ---
export type SortKey = 'name' | 'size' | 'lastModified';
export type SortDirection = 'asc' | 'desc';
// --- END NEW ---

// Update the type definition to handle both formats
interface ThematicFocus {
  primary?: string;
  sub?: string;         // New format uses 'sub'
  subthemes?: string[]; // Old format uses 'subthemes' array
}

interface WorkflowStage {
  primary?: string;
  sub?: string;         // New format uses 'sub'
  subthemes?: string[]; // Old format uses 'subthemes' array
}

// Updated StructuredPath interface
export interface StructuredPath {
  collection?: string;
  jurisdiction?: {
    type?: string;
    name?: string;
  };
  thematicFocus?: ThematicFocus;
  issuingAuthority?: {
    type?: string; // Changed from primary
    name?: string; // Changed from related (and type changed from string[])
  };
  documentFunction?: string;
  version?: string;
  // Update workflowStage to store both primary and sub
  workflowStage?: WorkflowStage;
  item?: {
    fileName?: string; // Original filename
    cleanedFileName?: string; // Sanitized base name
    finalItemName?: string; // Full constructed filename (date_cleaned.ext)
    fileType?: string;
    publicationDate?: string; // Keep as string (YYYY-MM-DD)
  };
}

// KEEP THIS FileMetadata INTERFACE DEFINITION
export interface FileMetadata {
  documentId?: string; // Unique identifier for the document concept (optional)
  documentType?: string;
  level?: string;
  language?: string;
  tags?: string[]; // Changed to array
  topics?: string[]; // Changed to array
  accessLevel?: string;
  fileType?: string; // e.g., 'pdf', 'docx' (metadata, not necessarily extension)
  country?: string;
  // jurisdiction?: string; // This might be redundant with structuredPath.jurisdiction
  license?: string;
  entitiesMentioned?: string[]; // Changed to array
  // collection?: string; // This might be redundant with structuredPath.collection
  description?: string; // Added description
  structuredPath?: StructuredPath; // Ensure this uses the updated StructuredPath
  contentSummary?: string;
}
