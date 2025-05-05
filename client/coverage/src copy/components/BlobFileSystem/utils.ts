import type { FileSystemItem } from './types';

// Date formatting
export const formatDate = (dateString: string | Date): string => {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Format file size in bytes to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Check if the file is an image based on name/extension
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
  return imageExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

/**
 * Check if the file is a video based on name/extension
 */
export function isVideoFile(filename: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.wmv', '.flv'];
  return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

/**
 * Check if the file is an audio based on name/extension
 */
export function isAudioFile(filename: string): boolean {
  const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
  return audioExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

/**
 * Check if the file is a document based on name/extension
 */
export function isDocumentFile(filename: string): boolean {
  const docExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.rtf', '.md'];
  return docExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

// Filter items based on search term
export const filterItems = (items: FileSystemItem[], searchTerm: string): FileSystemItem[] => {
  if (!searchTerm) return items;
  
  const term = searchTerm.toLowerCase();
  return items.filter(item => 
    item.name.toLowerCase().includes(term) ||
    (item.metadata && Object.values(item.metadata).some(value => 
      value.toLowerCase().includes(term)
    ))
  );
};

// Create a hierarchical file system from flat list
export const createFileSystemHierarchy = (items: FileSystemItem[]): FileSystemItem[] => {
  const root: FileSystemItem[] = [];
  const lookup: { [key: string]: FileSystemItem } = {};
  
  // First pass: create lookup table
  items.forEach(item => {
    lookup[item.path] = { ...item, children: [] };
  });
  
  // Second pass: build hierarchy
  items.forEach(item => {
    if (!item.parentPath) {
      root.push(lookup[item.path]);
    } else {
      const parent = lookup[item.parentPath];
      if (parent && parent.children) {
        parent.children.push(lookup[item.path]);
      }
    }
  });
  
  return root;
};

// Fix by adding a proper interface that extends FileSystemItem with children
export interface FileSystemItemWithChildren extends FileSystemItem {
  children?: FileSystemItemWithChildren[];
}

// Update the function to use the new interface
export function buildFileTree(items: FileSystemItem[]): FileSystemItemWithChildren[] {
  const result: FileSystemItemWithChildren[] = [];
  const map: Record<string, FileSystemItemWithChildren> = {};
  
  // Convert all items to new type and create map
  items.forEach(item => {
    map[item.path] = { ...item } as FileSystemItemWithChildren;
  });
  
  // Build tree structure
  items.forEach(item => {
    const itemWithChildren = map[item.path];
    
    if (item.parentPath && map[item.parentPath]) {
      if (!map[item.parentPath].children) {
        map[item.parentPath].children = [];
      }
      map[item.parentPath].children!.push(itemWithChildren);
    } else {
      result.push(itemWithChildren);
    }
  });
  
  return result;
}
