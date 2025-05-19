import path from 'path';
import fs from 'fs';
import { ensureClient, streamToBuffer, safeJsonParse } from './blobHelpers.js';

// Cache the compiled metadata
let cachedMetadata = null;
let lastCompileTime = null;
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Compile all metadata from the blob storage into a single object
 */
export const compileAllMetadata = async (forceRefresh = false) => {
  console.log('[MetadataCompiler] Starting metadata compilation...');
  
  // Return cached metadata if available and not expired
  const now = new Date();
  if (!forceRefresh && 
      cachedMetadata && 
      lastCompileTime && 
      (now.getTime() - lastCompileTime.getTime() < CACHE_DURATION)) {
    console.log('[MetadataCompiler] Using cached metadata from', lastCompileTime);
    return cachedMetadata;
  }
  
  try {
    const client = ensureClient();
    const allMetadata = {
      documentIndex: {},
      collectionIndex: {},
      thematicIndex: {},
      compilationTime: new Date().toISOString()
    };
    
    // Find all metadata.json files
    let continuationToken = null;
    const metadataFiles = [];
    
    do {
      const response = await client.listBlobsFlat({
        prefix: '',
        includeMetadata: true,
        maxPageSize: 1000,
        continuationToken: continuationToken
      }).byPage().next();
      
      const segment = response.value;
      continuationToken = segment.continuationToken;
      
      // Find metadata.json files
      const batchMetadataFiles = segment.segment.blobItems.filter(blob => 
        blob.name.endsWith('/metadata.json')
      );
      
      metadataFiles.push(...batchMetadataFiles);
      
    } while (continuationToken);
    
    console.log(`[MetadataCompiler] Found ${metadataFiles.length} metadata.json files`);
    
    // Process each metadata file
    for (const metadataFile of metadataFiles) {
      try {
        const blobClient = client.getBlockBlobClient(metadataFile.name);
        const downloadResponse = await blobClient.download(0);
        const contentBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
        const metadataJson = safeJsonParse(contentBuffer.toString());
        
        if (!metadataJson || !metadataJson.files) continue;
        
        const dirPath = path.dirname(metadataFile.name);
        
        // Process each file in this metadata.json
        Object.entries(metadataJson.files).forEach(([fileName, fileMetadata]) => {
          const fullPath = path.posix.join(dirPath === '.' ? '' : dirPath, fileName);
          const documentId = fileMetadata.documentid || `doc-${Object.keys(allMetadata.documentIndex).length + 1}`;
          
          // Create a clean metadata record
          const metadataRecord = {
            documentId: documentId,
            name: fileName,
            path: fullPath,
            collection: fileMetadata.structuredPath?.collection || fileMetadata.collection || 'Unknown',
            thematicfocus: fileMetadata.structuredPath?.thematicFocus?.primary || fileMetadata.thematicfocus_primary || 'Unknown',
            subthemes: fileMetadata.structuredPath?.thematicFocus?.subthemes || [],
            jurisdiction: {
              type: fileMetadata.structuredPath?.jurisdiction?.type || fileMetadata.jurisdiction_type || 'Unknown',
              name: fileMetadata.structuredPath?.jurisdiction?.name || fileMetadata.jurisdiction_name || 'Unknown'
            },
            issuingAuthority: {
              type: fileMetadata.structuredPath?.issuingAuthority?.type || fileMetadata.issuingauthority_type || 'Unknown',
              name: fileMetadata.structuredPath?.issuingAuthority?.name || fileMetadata.issuingauthority_name || 'Unknown'
            },
            documentFunction: fileMetadata.structuredPath?.documentFunction || fileMetadata.documentfunction || 'Unknown',
            version: fileMetadata.structuredPath?.version || fileMetadata.version || 'Unknown',
            workflowStage: {
              primary: fileMetadata.structuredPath?.workflowStage?.primary || fileMetadata.workflowstage_primary || 'Unknown',
              sub: fileMetadata.structuredPath?.workflowStage?.sub || fileMetadata.workflowstage_sub || 'Unknown'
            },
            publicationDate: fileMetadata.structuredPath?.item?.publicationDate || fileMetadata.publicationdate || 'Unknown',
            language: fileMetadata.language || 'en',
            fileType: fileMetadata.structuredPath?.item?.fileType || fileMetadata.filetype || path.extname(fileName).substring(1) || 'Unknown',
            accessLevel: fileMetadata.accesslevel || 'public',
            additionalMetadata: {} // Any other metadata we want to keep
          };
          
          // Index by document ID
          allMetadata.documentIndex[documentId] = metadataRecord;
          
          // Index by collection
          const collection = metadataRecord.collection;
          if (!allMetadata.collectionIndex[collection]) {
            allMetadata.collectionIndex[collection] = [];
          }
          allMetadata.collectionIndex[collection].push(documentId);
          
          // Index by thematic focus
          const thematicFocus = metadataRecord.thematicfocus;
          if (!allMetadata.thematicIndex[thematicFocus]) {
            allMetadata.thematicIndex[thematicFocus] = [];
          }
          allMetadata.thematicIndex[thematicFocus].push(documentId);
        });
      } catch (error) {
        console.error(`[MetadataCompiler] Error processing ${metadataFile.name}:`, error.message);
      }
    }
    
    // Save to cache
    cachedMetadata = allMetadata;
    lastCompileTime = now;
    
    // Optional: save to disk for debugging
    const compiledMetadataPath = path.join(process.cwd(), 'compiled-metadata.json');
    fs.writeFileSync(compiledMetadataPath, JSON.stringify(allMetadata, null, 2));
    
    console.log(`[MetadataCompiler] Compilation complete. Indexed ${Object.keys(allMetadata.documentIndex).length} documents.`);
    
    return allMetadata;
  } catch (error) {
    console.error('[MetadataCompiler] Error compiling metadata:', error);
    throw error;
  }
};

/**
 * Get compiled metadata (from cache if available)
 */
export const getCompiledMetadata = async () => {
  if (!cachedMetadata) {
    return await compileAllMetadata();
  }
  return cachedMetadata;
};

/**
 * Get ChatGPT-friendly context from metadata
 */
export const getMetadataContext = async () => {
  const allMetadata = await getCompiledMetadata();
  
  // Create a compact, text-based representation for ChatGPT
  let context = `South African Constitutional Document Collection Metadata:\n\n`;
  
  // List collections
  context += `COLLECTIONS: ${Object.keys(allMetadata.collectionIndex).join(', ')}\n\n`;
  
  // List thematic focuses
  context += `THEMATIC FOCUSES: ${Object.keys(allMetadata.thematicIndex).join(', ')}\n\n`;
  
  // Create summaries of documents by collection
  context += `DOCUMENT SUMMARIES:\n\n`;
  
  Object.entries(allMetadata.documentIndex).forEach(([documentId, doc]) => {
    context += `Document ID: ${documentId}\n`;
    context += `Title: ${doc.name}\n`;
    context += `Collection: ${doc.collection}\n`;
    context += `Topic: ${doc.thematicfocus}\n`;
    context += `Jurisdiction: ${doc.jurisdiction.type}, ${doc.jurisdiction.name}\n`;
    context += `Document Type: ${doc.documentFunction}\n`;
    context += `Publication Date: ${doc.publicationDate}\n`;
    context += `Version: ${doc.version}\n`;
    context += `Issuing Authority: ${doc.issuingAuthority.type}, ${doc.issuingAuthority.name}\n\n`;
  });
  
  return context;
};

/**
 * Find documents matching given criteria 
 */
export const findMatchingDocuments = async (criteria) => {
  const allMetadata = await getCompiledMetadata();
  const matches = [];
  
  // Function to check if a document matches criteria
  const documentMatchesCriteria = (doc, criteria) => {
    for (const [key, value] of Object.entries(criteria)) {
      if (key === 'collection' && doc.collection !== value) {
        return false;
      }
      if (key === 'thematicfocus' && doc.thematicfocus !== value) {
        return false;
      }
      if (key === 'documentId' && doc.documentId !== value) {
        return false;
      }
      // Add more criteria as needed
    }
    return true;
  };
  
  // Simple exact match for documentId if provided
  if (criteria.documentId && allMetadata.documentIndex[criteria.documentId]) {
    return [allMetadata.documentIndex[criteria.documentId]];
  }
  
  // Check each document against criteria
  Object.values(allMetadata.documentIndex).forEach(doc => {
    if (documentMatchesCriteria(doc, criteria)) {
      matches.push(doc);
    }
  });
  
  return matches;
};

/**
 * Generate document URL using documentId from metadata
 */
export const generateDocumentUrl = async (document) => {
  try {
    const client = ensureClient();
    
    // First, we need to check if we have a document ID
    const documentId = document.documentId;
    
    if (documentId) {
      console.log(`[MetadataCompiler] Finding document by ID: ${documentId}`);
      
      // Search the container for the document with this ID
      const documentPath = await findDocumentPathById(documentId);
      
      if (documentPath) {
        console.log(`[MetadataCompiler] Found document at: ${documentPath}`);
        
        // Generate SAS URL for the actual document
        const blobClient = client.getBlockBlobClient(documentPath);
        
        // Generate SAS token with 1 hour expiry
        const expiresOn = new Date();
        expiresOn.setHours(expiresOn.getHours() + 1);
        
        const sasUrl = await blobClient.generateSasUrl({
          permissions: "r", // Read-only permission
          expiresOn: expiresOn
        });
        
        return sasUrl;
      }
    }
    
    // If no document ID or couldn't find by ID, fall back to using the direct path
    if (document && document.path) {
      console.log(`[MetadataCompiler] Falling back to direct path: ${document.path}`);
      const blobClient = client.getBlockBlobClient(document.path);
      
      // Check if blob exists
      const exists = await blobClient.exists();
      if (!exists) {
        console.log(`[MetadataCompiler] Document not found: ${document.path}`);
        return null;
      }
      
      // Generate SAS token with 1 hour expiry
      const expiresOn = new Date();
      expiresOn.setHours(expiresOn.getHours() + 1);
      
      const sasUrl = await blobClient.generateSasUrl({
        permissions: "r", // Read-only permission
        expiresOn: expiresOn
      });
      
      return sasUrl;
    }
    
    return null;
  } catch (error) {
    console.error('[MetadataCompiler] Error generating document URL:', error);
    return null;
  }
};

/**
 * Find document path by its ID
 */
async function findDocumentPathById(documentId) {
  try {
    const client = ensureClient();
    let documentPath = null;
    
    // First, check all metadata.json files for this document ID
    const metadataFiles = await findAllMetadataFiles(client);
    
    for (const metadataFile of metadataFiles) {
      // Extract the directory path
      const dirPath = path.dirname(metadataFile);
      
      // Download and parse the metadata.json file
      const metadataBlobClient = client.getBlockBlobClient(metadataFile);
      const downloadResponse = await metadataBlobClient.download(0);
      const contentBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
      const metadataJson = safeJsonParse(contentBuffer.toString());
      
      if (metadataJson && metadataJson.files) {
        // Check each file in the metadata.json
        for (const [fileName, fileInfo] of Object.entries(metadataJson.files)) {
          if (fileInfo.documentId === documentId) {
            // Found a match - construct the full path
            documentPath = path.posix.join(dirPath === '.' ? '' : dirPath, fileName);
            console.log(`[MetadataCompiler] Found document with ID ${documentId} at path: ${documentPath}`);
            return documentPath;
          }
        }
      }
    }
    
    // If not found in metadata files, try a direct blob metadata search
    console.log(`[MetadataCompiler] Document not found in metadata.json files, trying direct blob search...`);
    let continuationToken = null;
    
    do {
      const response = await client.listBlobsFlat({
        includeMetadata: true,
        maxPageSize: 100,
        continuationToken: continuationToken
      }).byPage().next();
      
      const segment = response.value;
      continuationToken = segment.continuationToken;
      
      // Process each blob
      for (const blob of segment.segment.blobItems) {
        if (blob.name.endsWith('/') || blob.name.endsWith('/metadata.json')) {
          continue;
        }
        
        const metadata = blob.metadata || {};
        
        if (metadata.documentid === documentId) {
          documentPath = blob.name;
          console.log(`[MetadataCompiler] Found document via blob metadata: ${documentPath}`);
          return documentPath;
        }
      }
    } while (continuationToken);
    
    console.log(`[MetadataCompiler] Document with ID ${documentId} not found`);
    return null;
  } catch (error) {
    console.error('[MetadataCompiler] Error finding document by ID:', error);
    return null;
  }
}

/**
 * Find all metadata.json files in the container
 */
async function findAllMetadataFiles(client) {
  const metadataFiles = [];
  let continuationToken = null;
  
  try {
    do {
      const response = await client.listBlobsFlat({
        prefix: '',
        maxPageSize: 1000,
        continuationToken: continuationToken
      }).byPage().next();
      
      const segment = response.value;
      continuationToken = segment.continuationToken;
      
      // Find metadata.json files
      const batchMetadataFiles = segment.segment.blobItems
        .filter(blob => blob.name.endsWith('/metadata.json') || blob.name === 'metadata.json')
        .map(blob => blob.name);
      
      metadataFiles.push(...batchMetadataFiles);
    } while (continuationToken);
    
    return metadataFiles;
  } catch (error) {
    console.error('[MetadataCompiler] Error finding metadata files:', error);
    return [];
  }
}
