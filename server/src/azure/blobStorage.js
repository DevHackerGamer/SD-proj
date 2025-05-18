import { BlobServiceClient } from '@azure/storage-blob';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateSasUrl } from './sasTokenGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Azure Blob Storage configuration
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

console.log("[Azure Blob] Initializing with container:", containerName);

// Create BlobServiceClient and ContainerClient
let blobServiceClient;
let containerClient;
let blobInitialized = false;

try {
  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  containerClient = blobServiceClient.getContainerClient(containerName);
  blobInitialized = true;
  console.log("[Azure Blob] Storage client initialized successfully");
} catch (error) {
  console.error("[Azure Blob] Failed to initialize storage client:", error.message);
}

// In-memory cache for blob content and document metadata
const blobCache = new Map();
const documentMetadataCache = new Map();

/**
 * Normalize a document path
 * @param {string} docPath - Raw document path or URL
 * @returns {string} - Normalized path
 */
function normalizeDocumentPath(docPath) {
  if (!docPath) return null;
  
  // Remove localhost or domain part if present
  if (docPath.includes('http://') || docPath.includes('https://')) {
    try {
      const url = new URL(docPath);
      return url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
    } catch (error) {
      console.error(`[Azure Blob] Error parsing URL ${docPath}:`, error.message);
    }
  }
  
  return docPath;
}

/**
 * Get document content from Azure Blob Storage
 * @param {string} blobName - Blob name/path
 * @returns {Promise<string|object|null>} - Document content or null if error
 */
export async function getDocumentContent(blobName) {
  try {
    if (!blobName) {
      console.log('[Azure Blob] No blob name provided');
      return null;
    }

    // Normalize blob name
    const normalizedBlobName = blobName.startsWith('/') ? blobName.substring(1) : blobName;
    
    console.log(`[Azure Blob] Fetching ${normalizedBlobName}`);

    if (!containerClient) {
      console.error('[Azure Blob] Container client not initialized');
      return null;
    }

    const blobClient = containerClient.getBlobClient(normalizedBlobName);
    const exists = await blobClient.exists();
    
    if (!exists) {
      console.log(`[Azure Blob] Blob ${normalizedBlobName} does not exist`);
      return null;
    }

    const downloadResponse = await blobClient.download();
    const contentType = downloadResponse.contentType || '';
    
    // Handle JSON files
    if (contentType.includes('json') || normalizedBlobName.endsWith('.json')) {
      const responseString = await streamToString(downloadResponse.readableStreamBody);
      console.log(`[Azure Blob] Found ${normalizedBlobName} in cache`);
      
      try {
        // Return the parsed JSON object directly, not as a string
        return JSON.parse(responseString);
      } catch (parseError) {
        console.error(`[Azure Blob] Error parsing JSON: ${parseError.message}`);
        // Return as string if parsing fails
        return responseString;
      }
    } 
    // Handle other text files
    else if (contentType.includes('text') || 
             normalizedBlobName.endsWith('.txt') || 
             normalizedBlobName.endsWith('.md')) {
      return await streamToString(downloadResponse.readableStreamBody);
    } 
    // Handle binary files or unknown content types
    else {
      console.log(`[Azure Blob] Non-text file type: ${contentType}`);
      return `[Binary file of type: ${contentType}]`;
    }
  } catch (error) {
    console.error(`[Azure Blob] Error getting blob content: ${error.message}`);
    return null;
  }
}

/**
 * Check if a document exists in blob storage
 * @param {string} docPath - Document path to check
 * @returns {Promise<boolean>} - True if document exists
 */
export async function documentExists(docPath) {
  try {
    if (!blobInitialized || !containerClient) {
      throw new Error("Blob storage client not initialized");
    }
    
    const normalizedPath = normalizeDocumentPath(docPath);
    console.log(`[Azure Blob] Checking if document exists: ${normalizedPath}`);
    
    const blobClient = containerClient.getBlobClient(normalizedPath);
    const exists = await blobClient.exists();
    
    console.log(`[Azure Blob] Document ${normalizedPath} exists: ${exists}`);
    return exists;
  } catch (error) {
    console.error(`[Azure Blob] Error checking document existence:`, error.message);
    return false;
  }
}

/**
 * Get a document with a SAS token for direct access
 * @param {string} docPath - Document path or URL
 * @returns {Promise<Object>} - Document content and SAS URL
 */
export async function getDocumentWithSasUrl(docPath) {
  try {
    if (!blobInitialized || !containerClient) {
      throw new Error("Blob storage client not initialized");
    }

    const normalizedPath = normalizeDocumentPath(docPath);
    console.log(`[Azure Blob] Getting document with SAS URL: ${normalizedPath}`);
    
    // Check if document exists
    const blobClient = containerClient.getBlobClient(normalizedPath);
    const exists = await blobClient.exists();
    
    if (!exists) {
      console.log(`[Azure Blob] Document not found: ${normalizedPath}`);
      return { content: null, sasUrl: null };
    }
    
    // Get document content
    const content = await getDocumentContent(normalizedPath);
    
    // Generate SAS URL
    const sasUrl = await generateSasUrl(normalizedPath, 60);
    
    return {
      content,
      sasUrl
    };
  } catch (error) {
    console.error(`[Azure Blob] Error getting document with SAS:`, error.message);
    return { content: null, sasUrl: null };
  }
}

/**
 * List all blobs in the container
 * @returns {Promise<Array<{name: string, metadata: object}>>} List of blob names and metadata
 */
export async function listAllDocuments() {
  try {
    if (!blobInitialized || !containerClient) {
      throw new Error("Blob storage client not initialized");
    }

    console.log("[Azure Blob] Listing all documents");
    
    const blobs = [];
    for await (const blob of containerClient.listBlobsFlat({ includeMetadata: true })) {
      blobs.push({
        name: blob.name,
        metadata: blob.metadata || {},
        properties: {
          contentType: blob.properties.contentType,
          createdOn: blob.properties.createdOn,
          lastModified: blob.properties.lastModified,
          contentLength: blob.properties.contentLength
        }
      });
    }
    
    console.log(`[Azure Blob] Found ${blobs.length} documents`);
    return blobs;
  } catch (error) {
    console.error("[Azure Blob] Error listing documents:", error.message);
    return [];
  }
}

/**
 * Convert a readable stream to a string
 * @param {ReadableStream} readableStream - The stream to convert
 * @returns {Promise<string>} - The stream content as a string
 */
async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data.toString());
    });
    readableStream.on('end', () => {
      resolve(chunks.join(''));
    });
    readableStream.on('error', reject);
  });
}

/**
 * Get the last line of a document's content
 * @param {string} blobName - Blob name/path in the container
 * @returns {Promise<string>} Last line from the document, or error message
 */
export async function getDocumentLastLine(blobName) {
  try {
    const documentData = await getDocumentContent(blobName);
    
    if (!documentData || !documentData.content) {
      return "Could not retrieve document content.";
    }
    
    // Split content by newlines and get the last non-empty line
    const lines = documentData.content.split('\n')
      .filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
      return "The document appears to be empty or contains only whitespace.";
    }
    
    return lines[lines.length - 1].trim();
  } catch (error) {
    console.error(`[Azure Blob] Error getting last line of ${blobName}:`, error.message);
    return `Error retrieving the last line: ${error.message}`;
  }
}

/**
 * Get specific document section by line numbers or page
 * @param {string} blobName - Blob name/path in the container
 * @param {Object} options - Options for extraction {startLine, endLine, page}
 * @returns {Promise<string>} Extracted section of document
 */
export async function getDocumentSection(blobName, options = {}) {
  try {
    const { startLine, endLine, page } = options;
    const documentData = await getDocumentContent(blobName);
    
    if (!documentData || !documentData.content) {
      return "Could not retrieve document content.";
    }
    
    // If page is specified, estimate page content (rough estimation)
    if (page && page > 0) {
      // Estimate ~40 lines per page for text documents
      const linesPerPage = 40;
      const lines = documentData.content.split('\n');
      const pageStart = (page - 1) * linesPerPage;
      const pageEnd = pageStart + linesPerPage;
      
      if (pageStart >= lines.length) {
        return `Page ${page} is beyond the document length.`;
      }
      
      return lines.slice(pageStart, Math.min(pageEnd, lines.length)).join('\n');
    }
    
    // Extract by line numbers
    if (startLine || endLine) {
      const lines = documentData.content.split('\n');
      const start = startLine > 0 ? startLine - 1 : 0;
      const end = endLine > 0 ? Math.min(endLine, lines.length) : lines.length;
      
      return lines.slice(start, end).join('\n');
    }
    
    // Default to returning the first 10 lines
    return documentData.content.split('\n').slice(0, 10).join('\n') + 
           "\n...\n[Content truncated. Specify line numbers or page to see more.]";
  } catch (error) {
    console.error(`[Azure Blob] Error getting section of ${blobName}:`, error.message);
    return `Error retrieving document section: ${error.message}`;
  }
}

export default {
  getDocumentContent,
  listAllDocuments,
  getDocumentWithSasUrl,
  documentExists,
  getDocumentLastLine,
  getDocumentSection
};
