import {
    BlobServiceClient,
    StorageSharedKeyCredential,
    BlobSASPermissions,
    generateBlobSASQueryParameters
  } from '@azure/storage-blob';
  import dotenv from 'dotenv';
  import path from 'path';
  import fs from 'fs';
  
  // Load environment variables
  const envPath = path.resolve(process.cwd(), '.env.local');
  dotenv.config({ path: envPath });
  
  // Document ID to generate SAS token for
  const DOCUMENT_ID = "3fb48fb7-ce85-4c3b-94ba-0502f88db891";
  
  // Azure Storage configuration from environment variables
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME?.replace(/"/g, '') || 'files';
  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  
  // Helper function to extract account info from connection string (if not directly provided)
  const getAccountInfo = () => {
    if (accountName && accountKey) {
      return { accountName, accountKey };
    }
    
    try {
      const parts = connectionString.split(';');
      const accountNamePart = parts.find(p => p.startsWith('AccountName='));
      const accountKeyPart = parts.find(p => p.startsWith('AccountKey='));
      
      if (accountNamePart && accountKeyPart) {
        return {
          accountName: accountNamePart.split('=')[1],
          accountKey: accountKeyPart.split('=')[1]
        };
      }
    } catch (e) {
      console.error("Failed to parse connection string:", e.message);
    }
    
    throw new Error("Azure Storage Account Name and Key are required for SAS generation.");
  };
  
  /**
   * Attempt to find a document by trying multiple search methods
   * 1. Check metadata (most reliable)
   * 2. Check common path patterns
   * 3. Search the entire container as a fallback
   */
  async function findDocumentBlob(containerClient, documentId) {
    console.log(`Searching for document with ID: ${documentId}`);
    
    // Method 1: Check if document exists with common path patterns
    const commonPaths = await tryCommonDocumentPaths(containerClient, documentId);
    if (commonPaths) return commonPaths;
    
    // Method 2: Search with metadata (most reliable if your app uses metadata)
    const metadataSearch = await searchByMetadata(containerClient, documentId);
    if (metadataSearch) return metadataSearch;
    
    // Method 3: Full container search as fallback
    return searchEntireContainer(containerClient, documentId);
  }
  
  /**
   * Try common document path patterns
   */
  async function tryCommonDocumentPaths(containerClient, documentId) {
    console.log(`Trying common document path patterns...`);
    
    // Common patterns for document storage
    const possiblePaths = [
      `${documentId}.pdf`,
      `${documentId}`,
      `documents/${documentId}.pdf`,
      `documents/${documentId}`,
      `files/${documentId}.pdf`,
      `files/${documentId}`,
      `uploads/${documentId}`,
      `uploads/${documentId}.pdf`
      // Add other common patterns your application might use
    ];
    
    for (const path of possiblePaths) {
      console.log(`Checking path: ${path}`);
      const blobClient = containerClient.getBlobClient(path);
      
      try {
        const exists = await blobClient.exists();
        if (exists) {
          console.log(`✓ Found document at path: ${path}`);
          return path;
        }
      } catch (error) {
        console.log(`Error checking path ${path}: ${error.message}`);
      }
    }
    
    console.log(`No common paths matched`);
    return null;
  }
  
  /**
   * Search for the document using metadata
   * This is more reliable than filename searching if your app stores document IDs in metadata
   */
  async function searchByMetadata(containerClient, documentId) {
    console.log(`Searching for document by metadata...`);
    
    let foundBlob = null;
    let continuationToken = null;
    
    try {
      do {
        const response = await containerClient.listBlobsFlat({
          maxPageSize: 50,
          continuationToken: continuationToken,
          includeMetadata: true // Important: request metadata
        }).byPage().next();
        
        const segment = response.value;
        continuationToken = segment.continuationToken;
        
        console.log(`Checking batch of ${segment.segment.blobItems.length} blobs...`);
        
        for (const blob of segment.segment.blobItems) {
          if (blob.metadata) {
            // Check all possible metadata keys (case-insensitive)
            const metadataKeys = Object.keys(blob.metadata).map(k => k.toLowerCase());
            const metadataValues = Object.values(blob.metadata);
            
            const hasDocIdInMetadata = metadataKeys.includes('documentid') || 
                                       metadataKeys.includes('docid') || 
                                       metadataKeys.includes('id');
            
            const hasDocIdInValues = metadataValues.some(v => 
              v.toString().toLowerCase() === documentId.toLowerCase()
            );
            
            if (hasDocIdInMetadata || hasDocIdInValues) {
              console.log(`✓ Found blob with matching metadata: ${blob.name}`);
              console.log(`Metadata: ${JSON.stringify(blob.metadata)}`);
              foundBlob = blob.name;
              break;
            }
          }
        }
        
        if (foundBlob) break;
        
      } while (continuationToken);
      
      return foundBlob;
    } catch (error) {
      console.error(`Error during metadata search: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Search entire container for blob names containing the document ID
   * This is a fallback option and less precise
   */
  async function searchEntireContainer(containerClient, documentId) {
    console.log(`Performing full container search (fallback)...`);
    
    let foundBlob = null;
    let continuationToken = null;
    
    try {
      do {
        const response = await containerClient.listBlobsFlat({
          maxPageSize: 100,
          continuationToken: continuationToken
        }).byPage().next();
        
        const segment = response.value;
        continuationToken = segment.continuationToken;
        
        console.log(`Checking batch of ${segment.segment.blobItems.length} blob names...`);
        
        for (const blob of segment.segment.blobItems) {
          if (blob.name.toLowerCase().includes(documentId.toLowerCase())) {
            console.log(`✓ Found blob with name containing document ID: ${blob.name}`);
            foundBlob = blob.name;
            break;
          }
        }
        
        if (foundBlob) break;
        
      } while (continuationToken);
      
      if (!foundBlob) {
        console.log(`No blob found containing document ID in the entire container`);
      }
      
      return foundBlob;
    } catch (error) {
      console.error(`Error during container search: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Generate a SAS token for the specified document
   * Following Azure best practices for security and performance
   */
  export default async function generateSasTokenForDocument(documentId) {
    try {
      console.log(`Generating SAS token for document: ${documentId}`);
      
      // Get Azure credentials
      const { accountName, accountKey } = getAccountInfo();
      const credential = new StorageSharedKeyCredential(accountName, accountKey);
      
      // Initialize Azure Storage client
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      
      // Search for the document blob using multiple strategies
      const blobPath = await findDocumentBlob(containerClient, documentId);
      if (!blobPath) {
        console.error(`Document blob not found for ID: ${documentId}`);
        return null;
      }
      
      console.log(`Found document at path: ${blobPath}`);
      
      // Get blob client
      const blobClient = containerClient.getBlobClient(blobPath);
      
      // Generate SAS token following Azure best practices
      const sasOptions = {
        containerName,
        blobName: blobPath,
        startsOn: new Date(Date.now() - 60 * 1000), // Start 1 min ago (clock skew protection)
        expiresOn: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiration
        permissions: BlobSASPermissions.parse("r"), // Read-only (least privilege)
        protocol: "https", // HTTPS only for security
      };
      
      const sasToken = generateBlobSASQueryParameters(sasOptions, credential).toString();
      const sasUrl = `${blobClient.url}?${sasToken}`;
      console.log(`Generated SAS URL: ${sasUrl}`);
      return sasUrl;
    } catch (error) {
      console.error("Error generating SAS token:", error.message);
      return null;
    }
  }
