import type { BlobItem, FileMetadata } from '../types';

// Generate a unique ID
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

// Sample metadata for demo purposes
const sampleMetadata: Record<string, FileMetadata> = {
  'constitution.pdf': {
    title: 'Constitution of South Africa',
    description: 'The Constitution of the Republic of South Africa, 1996',
    documentType: 'constitution',
    accessLevel: 'public',
    tags: ['constitution', 'democracy', 'bill of rights'],
    language: 'en',
    author: 'Constitutional Assembly',
    country: 'South Africa',
    createdDate: '1996-12-18',
    lastUpdated: '2022-01-15'
  },
  'bill_of_rights.pdf': {
    title: 'Bill of Rights',
    description: 'Chapter 2 of the Constitution - Bill of Rights',
    documentType: 'section',
    accessLevel: 'public',
    tags: ['bill of rights', 'human rights', 'equality'],
    language: 'en',
    author: 'Constitutional Assembly',
    country: 'South Africa',
    createdDate: '1996-12-18',
    lastUpdated: '2022-01-15'
  },
  'amendment_17.pdf': {
    title: 'Constitutional Amendment 17',
    description: 'Amendment to Section 25 - Property Rights',
    documentType: 'amendment',
    accessLevel: 'public',
    tags: ['amendment', 'property rights', 'land reform'],
    language: 'en',
    author: 'Parliament of South Africa',
    country: 'South Africa',
    createdDate: '2021-03-24',
    lastUpdated: '2022-01-15'
  }
};

// Common file types for demo
const fileTypes: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  png: 'image/png',
  txt: 'text/plain'
};

// Mock directory structure
const mockFileSystem: Record<string, BlobItem[]> = {
  '': [
    {
      id: generateId(),
      name: 'South Africa',
      path: 'south_africa',
      isDirectory: true,
      lastModified: '2023-01-15T10:30:00Z',
      contentType: 'directory',
      size: 0
    },
    {
      id: generateId(),
      name: 'Namibia',
      path: 'namibia',
      isDirectory: true,
      lastModified: '2023-01-15T10:30:00Z',
      contentType: 'directory',
      size: 0
    },
    {
      id: generateId(),
      name: 'Botswana',
      path: 'botswana',
      isDirectory: true,
      lastModified: '2023-01-15T10:30:00Z',
      contentType: 'directory',
      size: 0
    },
    {
      id: generateId(),
      name: 'README.txt',
      path: 'README.txt',
      isDirectory: false,
      lastModified: '2023-01-10T15:45:00Z',
      contentType: 'text/plain',
      size: 1024,
      metadata: {
        title: 'README',
        description: 'Information about the archive system',
        accessLevel: 'public'
      }
    }
  ],
  'south_africa': [
    {
      id: generateId(),
      name: 'Constitution',
      path: 'south_africa/constitution',
      isDirectory: true,
      lastModified: '2023-01-15T10:30:00Z',
      contentType: 'directory',
      size: 0
    },
    {
      id: generateId(),
      name: 'Legislation',
      path: 'south_africa/legislation',
      isDirectory: true,
      lastModified: '2023-01-15T10:30:00Z',
      contentType: 'directory',
      size: 0
    },
    {
      id: generateId(),
      name: 'Case Law',
      path: 'south_africa/case_law',
      isDirectory: true,
      lastModified: '2023-01-15T10:30:00Z',
      contentType: 'directory',
      size: 0
    }
  ],
  'south_africa/constitution': [
    {
      id: generateId(),
      name: 'constitution.pdf',
      path: 'south_africa/constitution/constitution.pdf',
      isDirectory: false,
      lastModified: '2023-01-16T12:15:00Z',
      contentType: 'application/pdf',
      size: 2458000,
      metadata: sampleMetadata['constitution.pdf']
    },
    {
      id: generateId(),
      name: 'bill_of_rights.pdf',
      path: 'south_africa/constitution/bill_of_rights.pdf',
      isDirectory: false,
      lastModified: '2023-01-16T12:16:00Z',
      contentType: 'application/pdf',
      size: 867000,
      metadata: sampleMetadata['bill_of_rights.pdf']
    },
    {
      id: generateId(),
      name: 'amendment_17.pdf',
      path: 'south_africa/constitution/amendment_17.pdf',
      isDirectory: false,
      lastModified: '2023-01-17T09:45:00Z',
      contentType: 'application/pdf',
      size: 523000,
      metadata: sampleMetadata['amendment_17.pdf']
    }
  ],
  'south_africa/legislation': [
    {
      id: generateId(),
      name: 'Water Act 36 of 1998.pdf',
      path: 'south_africa/legislation/Water Act 36 of 1998.pdf',
      isDirectory: false,
      lastModified: '2023-01-18T14:22:00Z',
      contentType: 'application/pdf',
      size: 1245000,
      metadata: {
        title: 'Water Act 36 of 1998',
        description: 'National Water Act of South Africa',
        documentType: 'act',
        accessLevel: 'public',
        tags: ['water', 'environment', 'natural resources'],
        language: 'en',
        country: 'South Africa',
        createdDate: '1998-08-26',
        lastUpdated: '2022-01-18'
      }
    }
  ],
  'namibia': [
    {
      id: generateId(),
      name: 'Constitution of Namibia.pdf',
      path: 'namibia/Constitution of Namibia.pdf',
      isDirectory: false,
      lastModified: '2023-01-19T10:11:00Z',
      contentType: 'application/pdf',
      size: 1876000,
      metadata: {
        title: 'Constitution of Namibia',
        description: 'The Constitution of the Republic of Namibia',
        documentType: 'constitution',
        accessLevel: 'public',
        tags: ['constitution', 'namibia', 'democracy'],
        language: 'en',
        country: 'Namibia',
        createdDate: '1990-03-21',
        lastUpdated: '2022-01-19'
      }
    }
  ],
  'botswana': []
};

/**
 * Returns mock files for a given directory
 */
export const getMockFiles = (directory: string): BlobItem[] => {
  // Normalize path (remove leading/trailing slashes)
  const normalizedPath = directory.replace(/^\/+|\/+$/g, '');
  
  // Return files for the directory or empty array if not found
  return mockFileSystem[normalizedPath] || [];
};

/**
 * Get a mock download URL for a file
 */
export const getMockDownloadUrl = (path: string): string => {
  // In a real implementation, this could generate a Blob URL to fake a download
  return `#mock-download-${path}`;
};

/**
 * Mock implementation for uploading a file
 */
export const mockUploadFile = (file: File, targetPath: string): BlobItem => {
  const fileName = file.name;
  const directory = targetPath || '';
  const fullPath = directory ? `${directory}/${fileName}` : fileName;
  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';
  
  const newItem: BlobItem = {
    id: generateId(),
    name: fileName,
    path: fullPath,
    isDirectory: false,
    lastModified: new Date().toISOString(),
    contentType: fileTypes[fileExt] || 'application/octet-stream',
    size: file.size,
    metadata: {
      title: fileName,
      description: `Uploaded on ${new Date().toLocaleString()}`,
      accessLevel: 'public'
    }
  };
  
  // Add to mock file system
  const directoryFiles = mockFileSystem[directory] || [];
  mockFileSystem[directory] = [...directoryFiles, newItem];
  
  return newItem;
};

/**
 * Create a mock directory
 */
export const mockCreateDirectory = (path: string, name: string): BlobItem => {
  const fullPath = path ? `${path}/${name}` : name;
  
  const newDirectory: BlobItem = {
    id: generateId(),
    name,
    path: fullPath,
    isDirectory: true,
    lastModified: new Date().toISOString(),
    contentType: 'directory',
    size: 0
  };
  
  // Add to parent directory
  const parentDir = mockFileSystem[path] || [];
  mockFileSystem[path] = [...parentDir, newDirectory];
  
  // Create empty array for new directory
  mockFileSystem[fullPath] = [];
  
  return newDirectory;
};
