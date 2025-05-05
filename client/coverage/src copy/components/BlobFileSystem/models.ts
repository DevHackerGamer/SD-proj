// Re-export types from types.ts to maintain backward compatibility
export type { 
  FileSystemItem, 
  BlobItem, 
  FileMetadata, 
  UploadOptions, 
  FileSystemState,
  FileViewOptions
} from './types';

export interface UploadProgressInfo {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}
