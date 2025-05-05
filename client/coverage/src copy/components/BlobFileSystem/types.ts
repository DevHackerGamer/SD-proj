// Shared interfaces for the BlobFileSystem component

export interface FileMetadata {
  title?: string;
  description?: string;
  documentType?: string;
  accessLevel?: string;
  tags?: string[];
  language?: string;
  author?: string;
  country?: string;
  createdDate?: string;
  lastUpdated?: string;
  [key: string]: any;
}

export interface BlobItem extends FileSystemItem {
  url?: string;
  accessLevel?: 'public' | 'restricted' | 'admin-only';
  tags?: string[];
}

export interface FileSystemItem {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  metadata?: FileMetadata;
  parentPath?: string;
  children?: FileSystemItem[];
  lastModified?: string;
  contentType?: string;
  size?: number;
}

export interface FileSystemState {
  items: FileSystemItem[];
  currentDirectory: string;
  selectedItems: string[];
  isLoading: boolean;
  error: string | null;
}

export interface FileViewOptions {
  view: 'grid' | 'list';
  viewMode?: 'grid' | 'list'; // Add this property to fix the error
  sortBy: 'name' | 'modified' | 'size' | 'type';
  sortDirection: 'asc' | 'desc';
}

export interface UploadProgressInfo {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface UploadOptions {
  directory?: string;
  metadata?: FileMetadata;
  onProgress?: (progress: number) => void;
}

export interface MoveItemsResponse {
  message: string;
  movedItems: BlobItem[];
  errors?: Array<{path: string, error: string}>;
}

// Type guard for BlobItem
export function isFileItem(item: FileSystemItem): item is FileSystemItem & { size: number } {
  return !item.isDirectory && typeof (item as any).size === 'number';
}
