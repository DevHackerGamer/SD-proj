import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters
} from '@azure/storage-blob';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Azure Storage configuration from environment variables
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

// Initialize clients
let blobServiceClient;
let containerClient;
let credential;

try {
  // Get Azure credentials
  if (!accountName || !accountKey) {
    const accountInfo = getAccountInfoFromConnectionString(connectionString);
    credential = new StorageSharedKeyCredential(accountInfo.accountName, accountInfo.accountKey);
  } else {
    credential = new StorageSharedKeyCredential(accountName, accountKey);
  }
  
  // Initialize Azure Storage client
  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  containerClient = blobServiceClient.getContainerClient(containerName);
  
  console.log(`[Azure SAS] Initialized SAS token generator for container: ${containerName}`);
} catch (error) {
  console.error(`[Azure SAS] Error initializing SAS token generator:`, error.message);
}

/**
 * Extract account info from connection string
 */
function getAccountInfoFromConnectionString(connString) {
  try {
    if (!connString) {
      throw new Error("Connection string is required");
    }
    
    const parts = connString.split(';');
    const accountNamePart = parts.find(p => p.startsWith('AccountName='));
    const accountKeyPart = parts.find(p => p.startsWith('AccountKey='));
    
    if (!accountNamePart || !accountKeyPart) {
      throw new Error("Connection string is missing AccountName or AccountKey");
    }
    
    return {
      accountName: accountNamePart.split('=')[1],
      accountKey: accountKeyPart.split('=')[1]
    };
  } catch (error) {
    console.error("[Azure SAS] Error parsing connection string:", error.message);
    throw new Error("Failed to parse Azure Storage connection string");
  }
}

/**
 * Properly fix a document path for SAS URL generation
 * @param {string} docPath - Document path which could be a URL or path
 * @returns {string} - Normalized blob path
 */
function normalizeBlobPath(docPath) {
  if (!docPath) return null;
  
  let normalizedPath = docPath;
  
  // Case 1: Handle localhost URLs
  if (docPath.includes('localhost:') || docPath.includes('127.0.0.1:')) {
    try {
      const urlObj = new URL(docPath.startsWith('http') ? docPath : `http://${docPath}`);
      normalizedPath = urlObj.pathname;
      if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1);
      }
      console.log(`[Azure SAS] Normalized localhost URL path: ${normalizedPath}`);
      return normalizedPath;
    } catch (error) {
      console.log(`[Azure SAS] Failed to parse as URL, treating as path: ${docPath}`);
    }
  }
  
  // Case 2: Handle full URLs (non-localhost)
  if (docPath.startsWith('http')) {
    try {
      const urlObj = new URL(docPath);
      normalizedPath = urlObj.pathname;
      if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1);
      }
      console.log(`[Azure SAS] Normalized URL path: ${normalizedPath}`);
      return normalizedPath;
    } catch (error) {
      console.log(`[Azure SAS] Failed to parse as URL, treating as path: ${docPath}`);
    }
  }
  
  // Case 3: Remove leading slashes
  if (normalizedPath.startsWith('/')) {
    normalizedPath = normalizedPath.substring(1);
  }
  
  console.log(`[Azure SAS] Final normalized path: ${normalizedPath}`);
  return normalizedPath;
}

/**
 * Generate a SAS token URL for a document
 * @param {string} docPath - Document path or URL
 * @param {number} expiryMinutes - Token expiration time in minutes
 * @returns {Promise<string|null>} - SAS URL or null if generation fails
 */
export async function generateSasUrl(docPath, expiryMinutes = 60) {
  try {
    if (!docPath) {
      console.error("[Azure SAS] Document path is required");
      return null;
    }
    
    if (!blobServiceClient || !containerClient || !credential) {
      console.error("[Azure SAS] Azure Storage client not initialized");
      return null;
    }

    // Normalize the document path
    const normalizedPath = normalizeBlobPath(docPath);
    console.log(`[Azure SAS] Generating SAS for normalized path: ${normalizedPath}`);
    
    // Get blob client
    const blobClient = containerClient.getBlobClient(normalizedPath);
    
    // Check if blob exists
    let exists = false;
    try {
      exists = await blobClient.exists();
    } catch (error) {
      console.log(`[Azure SAS] Error checking blob existence: ${error.message}`);
      // Continue anyway - some storage accounts don't allow exists check without permissions
    }
    
    if (!exists) {
      console.log(`[Azure SAS] Warning: Blob may not exist: ${normalizedPath}`);
      // Continue anyway as the check might fail due to permissions
    }
    
    // Generate SAS token
    const sasOptions = {
      containerName,
      blobName: normalizedPath,
      startsOn: new Date(Date.now() - 60 * 1000), // Start 1 min ago (clock skew protection)
      expiresOn: new Date(Date.now() + expiryMinutes * 60 * 1000),
      permissions: BlobSASPermissions.parse("r"), // Read-only
      protocol: "https",
    };
    
    const sasToken = generateBlobSASQueryParameters(sasOptions, credential).toString();
    const sasUrl = `${blobClient.url}?${sasToken}`;
    
    console.log(`[Azure SAS] Generated SAS URL for ${normalizedPath}`);
    return sasUrl;
  } catch (error) {
    console.error("[Azure SAS] Error generating SAS URL:", error.message);
    return null;
  }
}

export default {
  generateSasUrl,
  normalizeBlobPath
};
