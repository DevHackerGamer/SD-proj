import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  generateBlobSASQueryParameters
} from '@azure/storage-blob';
import dotenv from 'dotenv';
import path from 'path';
import archiver from 'archiver'; // Import archiver
import stream from 'stream'; // Import stream for pipeline
import crypto from 'crypto'; // Import crypto for UUID generation
import { formatMetadataForAzure, updateMetadataJsonFile } from '../utils/metadataHelper.js'; // Assuming helper exists
import { v4 as uuidv4 } from 'uuid'; // For generating documentId

// --- Configuration ---
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME; // Need account name from connection string or env
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY; // Need account key from connection string or env

console.log("[BlobController] Loading configuration...");
console.log("[BlobController] AZURE_STORAGE_CONNECTION_STRING provided:", !!connectionString);
console.log("[BlobController] AZURE_STORAGE_CONTAINER_NAME:", containerName);

if (!connectionString || !containerName || !connectionString.includes('AccountName=') || !connectionString.includes('AccountKey=')) {
  const errorMsg = !connectionString ? "AZURE_STORAGE_CONNECTION_STRING is not defined."
                 : !containerName ? "AZURE_STORAGE_CONTAINER_NAME is not defined."
                 : "AZURE_STORAGE_CONNECTION_STRING format appears invalid.";
  console.error(`❌ FATAL: ${errorMsg}`);
  throw new Error(`Azure Storage configuration error: ${errorMsg}`);
}

// --- Helper to extract account details (Alternative to separate env vars) ---
const getAccountInfo = () => {
    if (accountName && accountKey) {
        return { accountName, accountKey };
    }
    // Attempt to parse from connection string if separate vars aren't set
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
    } catch (e) { /* ignore parsing errors */ }
    throw new Error("Azure Storage Account Name and Key are required for SAS generation and not found/parsable.");
};


// --- Azure Client Initialization ---
let containerClient;
let sharedKeyCredential; // Store credential for SAS
try {
  console.log("[BlobController] Initializing Azure BlobServiceClient...");
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  containerClient = blobServiceClient.getContainerClient(containerName);
  console.log(`✅ Azure BlobServiceClient initialized for container "${containerName}".`);
  const { accountName: name, accountKey: key } = getAccountInfo();
  sharedKeyCredential = new StorageSharedKeyCredential(name, key); // Create credential
  console.log(`✅ SharedKeyCredential created for SAS generation.`);
} catch (error) {
  console.error("❌ FATAL: Failed to initialize Azure BlobServiceClient:", error);
  containerClient = null; // Ensure client is null if initialization fails
  console.error("❌ Azure client is NOT initialized. Endpoints will fail.");
  sharedKeyCredential = null;
  console.error("❌ SharedKeyCredential NOT created. SAS URL generation will fail.");
  // Optionally re-throw to prevent server start: throw error;
}

// --- Helper ---
const ensureClient = () => {
  if (!containerClient) {
    console.error("❌ Azure client not initialized.");
    throw new Error("Azure Blob Storage client is not available. Check server startup logs.");
  }
  return containerClient;
};

const ensureClientAndCredentials = () => {
    ensureClient(); // Ensure containerClient is ready
    if (!sharedKeyCredential) {
        console.error("❌ SharedKeyCredential not initialized.");
        throw new Error("Azure credential for SAS generation is not available.");
    }
    return { client: containerClient, credential: sharedKeyCredential };
};

// --- NEW: Helper function to safely parse JSON ---
const safeJsonParse = (str) => {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
};
// --- END NEW ---

// --- Modified: Helper function to update metadata.json with ETag ---
// Added 'action' parameter: 'update' (default) or 'remove'
const updateMetadataJson = async (containerClient, directoryPath, itemEntry, action = 'update') => {
    // --- Add Logging at Start ---
    console.log(`[Metadata Helper Entry] Action: ${action}, Dir: "${directoryPath || '(root)'}", Entry Name: ${itemEntry?.name}`);
    // --- End Logging ---

    // --- Add validation for action ---
    if (action !== 'update' && action !== 'remove') {
        console.warn(`[Metadata Helper] Invalid action "${action}" provided. Aborting update.`);
        return; // Or throw an error
    }
    // --- End validation ---

    // --- Modify validation for remove action ---
    // Allow metadata to be missing for remove action, but name is required for both
    if (!itemEntry || !itemEntry.name || (action === 'update' && !itemEntry.metadata)) {
        // --- Log the problematic itemEntry ---
        console.warn(`[Metadata Helper] Skipping ${action} in "${directoryPath || '(root)'}": Invalid itemEntry. Provided:`, itemEntry);
        // --- End Log ---
        return;
    }
    // --- End modify validation ---

    // --- Ensure directoryPath is handled correctly for root ---
    const effectiveDirectoryPath = directoryPath || ''; // Treat null/undefined/empty string as root
    const metadataFileName = path.posix.join(effectiveDirectoryPath, 'metadata.json');
    // --- End Ensure ---
    const blobClient = containerClient.getBlockBlobClient(metadataFileName);
    let metadataJson = { files: {}, folders: {} };
    let currentEtag = undefined; // Variable to store the ETag
    let fileExists = false; // Track if the file entry exists
    let folderExists = false; // Track if the folder entry exists

    console.log(`[Metadata Helper] Attempting to ${action} entry for "${itemEntry.name}" in: ${metadataFileName}`);

    try {
        // Try to download existing metadata and get ETag
        const downloadResponse = await blobClient.download(0); // Download from beginning
        currentEtag = downloadResponse.etag; // Store the ETag
        const contentBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
        const existingData = safeJsonParse(contentBuffer.toString());

        if (existingData) {
            metadataJson = existingData;
            metadataJson.files = metadataJson.files || {}; // Ensure files object exists
            metadataJson.folders = metadataJson.folders || {}; // Ensure folders object exists
            // Check existence in both files and folders
            fileExists = !!metadataJson.files[itemEntry.name];
            folderExists = !!metadataJson.folders[itemEntry.name];
            console.log(`[Metadata Helper] Found existing metadata.json in "${effectiveDirectoryPath || '(root)'}" with ETag: ${currentEtag}`);
        } else {
             console.warn(`[Metadata Helper] Existing metadata.json in "${effectiveDirectoryPath || '(root)'}" is invalid. Overwriting on 'update', ignoring on 'remove'.`);
             currentEtag = undefined; // Treat as if it didn't exist for upload condition
             if (action === 'remove') return; // Cannot remove from invalid/non-existent file
        }
    } catch (error) {
        if (error.statusCode === 404) {
            console.log(`[Metadata Helper] No existing metadata.json found in "${effectiveDirectoryPath || '(root)'}". Creating new one on 'update', ignoring on 'remove'.`);
            currentEtag = undefined; // No ETag for new file
            if (action === 'remove') return; // Cannot remove from non-existent file
        } else {
            console.error(`[Metadata Helper] Error downloading metadata.json from "${effectiveDirectoryPath || '(root)'}":`, error);
            // Decide if you want to proceed or throw error - let's proceed but log for 'update', throw for 'remove'?
            if (action === 'remove') throw new Error(`Failed to read metadata.json to remove entry: ${error.message}`);
            // For 'update', we might still want to try overwriting if download failed for other reasons
            currentEtag = undefined; // Attempt upload without ETag condition if download failed unexpectedly
        }
    }

    // --- Modify based on action ---
    let metadataChanged = false;
    if (action === 'update') {
        // Add/Update the file or folder entry
        // --- Add Logging for Update Data ---
        console.log(`[Metadata Helper Update] Comparing existing entry: ${JSON.stringify(metadataJson.files[itemEntry.name] ?? metadataJson.folders[itemEntry.name])} with new: ${JSON.stringify(itemEntry.metadata)}`);
        // --- End Logging ---

        // Determine if it's a file or folder based on metadata structure or itemEntry properties if available
        // For now, assume files based on typical usage, but ideally, itemEntry would indicate type.
        // Let's assume if metadata exists, it's a file for now. Folders might not have metadata in this structure.
        const isLikelyFile = !!itemEntry.metadata; // Simple check

        if (isLikelyFile) {
            if (JSON.stringify(metadataJson.files[itemEntry.name]) !== JSON.stringify(itemEntry.metadata)) {
                metadataJson.files[itemEntry.name] = itemEntry.metadata;
                // If it existed as a folder before, remove it
                if (folderExists) delete metadataJson.folders[itemEntry.name];
                metadataChanged = true;
                console.log(`[Metadata Helper] Updated file entry for "${itemEntry.name}".`);
            } else {
                console.log(`[Metadata Helper] No change detected for file "${itemEntry.name}". Skipping upload.`);
            }
        } else {
            // Handle folder update/creation if needed - currently, folders might not have metadata
            // If we just need to ensure the folder exists in the list:
            if (!folderExists && !fileExists) { // Only add if it doesn't exist as file or folder
                 metadataJson.folders[itemEntry.name] = {}; // Add folder entry (empty object or specific folder metadata)
                 metadataChanged = true;
                 console.log(`[Metadata Helper] Added folder entry for "${itemEntry.name}".`);
            } else if (fileExists) {
                 console.log(`[Metadata Helper] Item "${itemEntry.name}" exists as a file, not updating as folder.`);
            } else {
                 console.log(`[Metadata Helper] Folder entry for "${itemEntry.name}" already exists. Skipping.`);
            }
        }

    } else if (action === 'remove') {
        // Remove the entry if it exists (check both files and folders)
        if (fileExists) {
            delete metadataJson.files[itemEntry.name];
            metadataChanged = true;
            console.log(`[Metadata Helper] Removed file entry for "${itemEntry.name}".`);
        } else if (folderExists) { // Check folders if not found in files
            delete metadataJson.folders[itemEntry.name];
            metadataChanged = true;
            console.log(`[Metadata Helper] Removed folder entry for "${itemEntry.name}".`);
        } else {
            console.log(`[Metadata Helper] Entry for "${itemEntry.name}" not found in files or folders. Skipping removal.`);
        }
    }
    // --- End modify ---

    // --- Only upload if metadata actually changed ---
    if (!metadataChanged) {
        console.log(`[Metadata Helper Exit] No metadata changes detected for "${itemEntry.name}". Exiting.`); // Add log
        return; // Exit if no changes were made
    }
    // --- End check ---

    // Upload the updated metadata.json with ETag condition
    try {
        // --- Handle empty metadata.json ---
        // If after removal, both files and folders are empty, delete metadata.json?
        // Check if keys exist before checking length
        const filesEmpty = !metadataJson.files || Object.keys(metadataJson.files).length === 0;
        const foldersEmpty = !metadataJson.folders || Object.keys(metadataJson.folders).length === 0;

        if (filesEmpty && foldersEmpty) {
            console.log(`[Metadata Helper] metadata.json is now empty. Deleting ${metadataFileName}.`);
            // Use deleteIfExists for safety, applying ETag condition if available
            await blobClient.deleteIfExists({ conditions: currentEtag ? { ifMatch: currentEtag } : undefined });
            console.log(`[Metadata Helper Exit] Successfully deleted empty ${metadataFileName}`);
            return; // Exit after deletion
        }
        // --- End handle ---

        const content = JSON.stringify(metadataJson, null, 2);
        const uploadOptions = {
            blobHTTPHeaders: { blobContentType: 'application/json' },
            conditions: currentEtag ? { ifMatch: currentEtag } : undefined
        };
        // --- Add Logging Before Upload ---
        console.log(`[Metadata Helper Upload] Uploading to ${metadataFileName}. ETag condition: ${currentEtag || 'None'}. File keys: ${Object.keys(metadataJson.files || {})}, Folder keys: ${Object.keys(metadataJson.folders || {})}`);
        // --- End Logging ---
        await blobClient.upload(content, content.length, uploadOptions);
        console.log(`[Metadata Helper Exit] Successfully processed ${action} for "${itemEntry.name}" in ${metadataFileName}`); // Add log
    } catch (uploadError) {
        // ... (keep existing ETag error handling) ...
        console.error(`[Metadata Helper Exit] Upload failed for ${metadataFileName}. Error:`, uploadError); // Add log
        if (uploadError.statusCode === 412) { // Precondition Failed (ETag mismatch)
             console.warn(`[Metadata Helper] ETag mismatch for ${metadataFileName}. Concurrent update likely occurred. Consider retrying.`);
             // Optionally: Implement retry logic here (read again, merge changes, try upload again)
             // For now, we just log the warning. The operation for this specific item failed.
             throw new Error(`ETag mismatch for ${metadataFileName}. Operation for ${itemEntry.name} may need retry.`); // Propagate error
        } else {
            // Handle other upload errors
            console.error(`[Metadata Helper] Error uploading metadata.json to "${metadataFileName}":`, uploadError);
            throw uploadError; // Propagate other errors
        }
    }
};

// Helper to convert stream to buffer (needed for downloadResponse)
async function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}
// --- END MODIFIED HELPER ---


// --- Core Controller Methods ---

export const testConnection = async (req, res) => {
  console.log("[Server] Request: /test-connection");
  try {
    const client = ensureClient();
    await client.getProperties();
    console.log("[Server] Response: /test-connection - Success");
    res.status(200).json({ message: 'Connection successful.' });
  } catch (error) {
    console.error('[Server] Error: /test-connection:', error);
    res.status(500).json({ message: 'Connection failed.', error: error.message, details: error.code });
  }
};

export const listFiles = async (req, res) => {
  const directoryPath = req.query.path || '';
  console.log(`[Server] Request: /list - Path: "${directoryPath}"`);
  try {
    // --- FIX: ensureClient() already returns the container client ---
    const containerClient = ensureClient(); // Use the returned client directly
    // const containerClient = client.getContainerClient(); // Remove this redundant line
    // --- END FIX ---
    const items = [];
    const delimiter = '/';

    // Use listBlobsByHierarchy to get files and subdirectories
    const iterator = containerClient.listBlobsByHierarchy(delimiter, {
        prefix: directoryPath ? `${directoryPath}/` : '',
        // --- *** CRUCIAL STEP: Include Metadata *** ---
        includeMetadata: true
        // --- *** END CRUCIAL STEP *** ---
    });

    for await (const item of iterator) {
        if (item.kind === 'prefix') {
            // It's a directory (prefix)
            const dirName = item.name.substring(directoryPath.length).replace(/^\//, '').replace(/\/$/, '');
             if (dirName) { // Avoid adding empty names if prefix matches directoryPath exactly
                items.push({
                    id: `dir:${directoryPath ? directoryPath + '/' : ''}${dirName}`, // Generate a unique-ish ID
                    name: dirName,
                    path: `${directoryPath ? directoryPath + '/' : ''}${dirName}`,
                    isDirectory: true,
                    // Metadata typically not applicable/fetched for prefixes
                });
             }
        } else {
            // It's a blob (file)
            items.push({
                id: `blob:${item.name}`, // Generate a unique-ish ID
                name: path.basename(item.name),
                path: item.name,
                isDirectory: false,
                size: item.properties.contentLength,
                lastModified: item.properties.lastModified,
                contentType: item.properties.contentType,
                // --- *** CRUCIAL STEP: Add Metadata to Response *** ---
                metadata: item.metadata || {} // Include fetched metadata, default to empty object
                // --- *** END CRUCIAL STEP *** ---
            });
        }
    }

    console.log(`[Server] Response: /list - Found ${items.length} items for path "${directoryPath}".`);
    res.status(200).json(items);

  } catch (error) {
    console.error(`[Server] Error: /list - Path "${directoryPath}":`, error);
    res.status(500).json({ message: 'Failed to list files.', error: error.message, details: error.code });
  }
};

export const createDirectory = async (req, res) => {
  const { path: dirPath } = req.body;
  console.log(`[Server] Request: /directory - Path: "${dirPath}"`);
  if (!dirPath || !dirPath.trim() || dirPath.includes('//') || dirPath.startsWith('/') || dirPath.endsWith('.')) {
    return res.status(400).json({ message: 'Invalid directory path provided.' });
  }
  // Ensure trailing slash for placeholder convention
  const blobName = dirPath.endsWith('/') ? dirPath : `${dirPath}/`;
  try {
    const client = ensureClient();
    const blockBlobClient = client.getBlockBlobClient(blobName);
    const exists = await blockBlobClient.exists();
    if (exists) {
      console.log(`[Server] Response: /directory - Already exists: ${blobName}`);
      // Check if it's actually a directory placeholder
      const props = await blockBlobClient.getProperties();
      if (props.metadata?.isDirectoryPlaceholder === "true") {
         return res.status(200).json({ message: 'Directory already exists', path: dirPath.replace(/\/$/, '') });
      } else {
         return res.status(409).json({ message: 'A file with the same name already exists.' });
      }
    }
    // Create the 0-byte placeholder blob
    await blockBlobClient.uploadData(Buffer.alloc(0), { metadata: { isDirectoryPlaceholder: "true" } });
    console.log(`[Server] Response: /directory - Created: ${blobName}`);
    res.status(201).json({ message: 'Directory created.', path: dirPath.replace(/\/$/, '') });
  } catch (error) {
    console.error(`[Server] Error: /directory - Path "${dirPath}":`, error);
    res.status(500).json({ message: 'Failed to create directory.', error: error.message, details: error.code });
  }
};

// --- Modified uploadFile Controller ---
export const uploadFile = async (req, res) => {
  console.log('[Server] Request: /upload');
  if (!req.file) {
    console.log('[Server] Error: /upload - No file provided.');
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  // --- Get metadata and targetPath from request body ---
  const metadataString = req.body.metadata;
  const targetPath = req.body.targetPath; // e.g., "data/south_africa/collection/type/file.pdf"
  let clientMetadata = safeJsonParse(metadataString); // Use let as we might modify it
  // --- End Get ---

  console.log(`[Server] /upload - Received Target Path: ${targetPath}`);
  // console.log(`[Server] /upload - Received Metadata:`, metadata); // Log metadata if needed

  // --- Validate metadata and targetPath ---
  if (!clientMetadata) {
      return res.status(400).json({ error: "Invalid or missing metadata." });
  }
  if (!targetPath || typeof targetPath !== 'string' || targetPath.startsWith('/')) {
      // Basic path validation (adjust as needed)
      return res.status(400).json({ error: "Invalid or missing target path." });
  }
  // --- End Validation ---

  // Use the targetPath directly as the blob name (Azure handles virtual folders)
  // Normalize path separators to forward slashes for consistency in blob names
  const blobName = targetPath.replace(/\\/g, '/');
  console.log(`[Server] /upload - Attempting: "${req.file.originalname}" to blob "${blobName}"`);

  try {
    const client = ensureClient();
    const blockBlobClient = client.getBlockBlobClient(blobName);

    // --- Handle Document ID ---
    let documentId = clientMetadata.documentId;
    if (!documentId) {
        documentId = crypto.randomUUID();
        console.log(`[Server] /upload - Generated new Document ID: ${documentId} for ${blobName}`);
        clientMetadata.documentId = documentId; // Add to the metadata object we'll save in metadata.json
    } else {
        console.log(`[Server] /upload - Using existing Document ID: ${documentId} for ${blobName}`);
    }
    // --- End Handle Document ID ---

    // --- Prepare blob metadata from frontend metadata ---
    const blobMetadata = {
        // Map relevant fields from your FileMetadata interface
        documentid: documentId, // Add documentId here
        documenttype: clientMetadata.documentType || '',
        level: clientMetadata.level || '',
        language: clientMetadata.language || '',
        tags: clientMetadata.tags?.join(',') || '', // Store arrays as comma-separated strings
        topics: clientMetadata.topics?.join(',') || '',
        accesslevel: clientMetadata.accessLevel || '',
        filetype: clientMetadata.fileType || '',
        country: clientMetadata.country || '',
        jurisdiction: clientMetadata.jurisdiction || '',
        license: clientMetadata.license || '',
        entitiesmentioned: clientMetadata.entitiesMentioned?.join(',') || '',
        collection: clientMetadata.collection || '',
        originalfilename: req.file.originalname || '', // Keep original name
    };
    // Filter out empty metadata values
    const filteredBlobMetadata = Object.entries(blobMetadata)
        .filter(([_, value]) => value !== '')
        .reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
    // --- End Prepare blob metadata ---

    // Upload the main file
    const uploadBlobResponse = await blockBlobClient.upload(req.file.buffer, req.file.buffer.length, {
        blobHTTPHeaders: { blobContentType: req.file.mimetype },
        metadata: filteredBlobMetadata, // Attach metadata here
    });
    console.log(`[Server] /upload - Blob ${blobName} uploaded successfully. Request ID: ${uploadBlobResponse.requestId}`);

    // --- *** CRUCIAL STEP: Set Metadata on the Blob *** ---
    try {
        await blockBlobClient.setMetadata(filteredBlobMetadata);
        console.log(`[Server] /upload - Metadata successfully set on blob: ${blobName}`);
    } catch (metadataError) {
         console.error(`[Server] /upload - Error setting metadata on blob ${blobName}:`, metadataError);
         // Decide how to handle: continue? return error?
         // Let's return an error for now as metadata is important
         return res.status(500).json({ message: `File uploaded, but failed to set metadata on blob: ${metadataError.message}` });
    }
    // --- *** END CRUCIAL STEP *** ---

    // --- Update metadata.json in the parent directory ---
    const parentDirectory = path.posix.dirname(blobName); // Use posix.dirname
    const fileName = path.posix.basename(blobName);

    if (fileName && fileName !== '.') { // Ensure we have a valid filename
        const fileMetadataEntry = {
            name: fileName,
            metadata: clientMetadata, // Store the full metadata object received from client
            // Add other info if needed: size: req.file.size, uploadedAt: new Date().toISOString()
        };
        // Handle root directory case where dirname is '.'
        const dirForMetadata = parentDirectory === '.' ? '' : parentDirectory;
        console.log(`[Server] /upload - Triggering metadata.json update for file '${fileName}' in directory: '${dirForMetadata || '(root)'}'`);
        await updateMetadataJson(client, dirForMetadata, fileMetadataEntry);
    } else {
         console.warn(`[Server] /upload - Could not determine filename or parent directory from blobName: ${blobName}. Skipping metadata.json update.`);
    }
    // --- End Update metadata.json ---

    // --- Return correct JSON structure ---
    console.log(`[Server] Response: /upload - Success: "${blobName}"`);
    res.status(201).json({
        message: 'File uploaded successfully with metadata!',
        filePath: blobName, // Return the full path used for the blob
        documentId: documentId // Return the ID used/generated
    });
    // --- End Return ---

  } catch (error) {
    console.error(`[Server] Error: /upload - File "${req.file.originalname}" to "${blobName}":`, error);
    res.status(500).json({ message: 'Failed to upload file.', error: error.message, details: error.code });
  }
};
// --- End Modified uploadFile ---

export const deleteItem = async (req, res) => {
  const { path: itemPath } = req.query;
  console.log(`[Server] Request: /delete - Path: "${itemPath}"`);

  if (!itemPath) {
    console.log('[Server] Error: /delete - Missing path.');
    return res.status(400).json({ message: 'Item path is required.' });
  }

  try {
    const client = ensureClient();
    // Use posix for consistency, ensure trailing slash is handled for dirname/basename
    const fullPathForParts = itemPath.endsWith('/') ? itemPath.slice(0, -1) : itemPath;
    const directoryPath = path.posix.dirname(fullPathForParts); // Parent directory path
    const itemName = path.posix.basename(fullPathForParts); // Name of the item being deleted

    // --- Determine if it's a directory or file ---
    let isDirectory = false;
    let isFile = false;
    let effectiveItemPath = itemPath; // Path to use for operations

    const blobClient = client.getBlockBlobClient(itemPath); // Check path as provided first
    const existsAsBlob = await blobClient.exists();

    if (existsAsBlob) {
        const properties = await blobClient.getProperties();
        if (properties.metadata?.isDirectoryPlaceholder === "true") {
            isDirectory = true;
            effectiveItemPath = itemPath.endsWith('/') ? itemPath : `${itemPath}/`; // Ensure trailing slash for dir ops
            console.log(`[Server] /delete - Identified "${itemPath}" as directory placeholder.`);
        } else {
            isFile = true; // Exists and is not a placeholder, treat as file
            console.log(`[Server] /delete - Identified "${itemPath}" as a file.`);
        }
    } else {
        // Doesn't exist as a specific blob. Check if it's a directory prefix.
        // Add trailing slash if missing for prefix check
        const prefixToCheck = itemPath.endsWith('/') ? itemPath : `${itemPath}/`;
        const iter = client.listBlobsFlat({ prefix: prefixToCheck });
        const firstItem = await iter.next();
        if (!firstItem.done) {
            // Found items under this prefix, treat as directory
            isDirectory = true;
            effectiveItemPath = prefixToCheck; // Use the path with trailing slash
            console.log(`[Server] /delete - Identified "${itemPath}" as directory by prefix contents.`);
        } else {
             // Doesn't exist as a blob, placeholder, or non-empty prefix
             console.log(`[Server] /delete - Item not found: "${itemPath}"`);
             return res.status(404).json({ message: 'Item not found.' });
        }
    }
    // --- End Determination ---


    if (isDirectory) {
      // --- Delete Directory Contents ---
      const prefix = effectiveItemPath; // Use path with guaranteed trailing slash
      console.log(`[Server] /delete - Deleting contents of directory: "${prefix}"`);
      // ... (rest of existing directory deletion logic: listBlobsFlat, deleteBlob loop) ...
      const blobs = client.listBlobsFlat({ prefix });
      let deletedCount = 0;
      for await (const blob of blobs) {
        try {
          await client.deleteBlob(blob.name);
          deletedCount++;
          console.log(`[Server] /delete - Deleted blob within directory: ${blob.name}`);
        } catch (delError) {
           console.warn(`[Server] /delete - Failed to delete blob ${blob.name} within directory:`, delError.message);
           // Decide if this should halt the process or just log
        }
      }
      console.log(`[Server] /delete - Deleted ${deletedCount} blobs within "${prefix}".`);


      // --- Attempt to delete the metadata.json within the directory ---
      const metadataJsonPath = path.posix.join(prefix, 'metadata.json'); // Use prefix
      // ... (rest of existing internal metadata.json deletion logic) ...
      try {
          const metadataBlobClient = client.getBlockBlobClient(metadataJsonPath);
          const deleteMetaResponse = await metadataBlobClient.deleteIfExists();
          if (!deleteMetaResponse.errorCode) {
              console.log(`[Server] /delete - Deleted metadata.json within directory: "${metadataJsonPath}"`);
          } else {
              console.log(`[Server] /delete - metadata.json not found or error deleting within directory: "${metadataJsonPath}"`, deleteMetaResponse.errorCode);
          }
      } catch (metaDelError) {
          console.warn(`[Server] /delete - Error explicitly deleting metadata.json at "${metadataJsonPath}":`, metaDelError.message);
      }


      // --- Attempt to delete the directory placeholder itself (if used) ---
      // Only try if it existed as a placeholder initially
      if (existsAsBlob && properties.metadata?.isDirectoryPlaceholder === "true") {
          try {
              const dirPlaceholderClient = client.getBlockBlobClient(prefix); // The directory path itself
              const deletePlaceholderResponse = await dirPlaceholderClient.deleteIfExists({ deleteSnapshots: 'include' });
               if (!deletePlaceholderResponse.errorCode) {
                   console.log(`[Server] /delete - Deleted directory placeholder: "${prefix}"`);
               }
          } catch (placeholderDelError) {
              console.warn(`[Server] /delete - Error deleting directory placeholder "${prefix}":`, placeholderDelError.message);
          }
      }
      // --- End Delete Placeholder ---

      // --- Update Parent Directory's metadata.json ---
      try {
          // Handle root case for parent directory
          const parentDirForMeta = directoryPath === '.' ? '' : directoryPath;
          console.log(`[Server] /delete - Updating parent metadata.json in "${parentDirForMeta || '(root)'}" to remove folder entry: "${itemName}"`);
          // Pass the directory name to remove from the 'folders' key
          await updateMetadataJson(client, parentDirForMeta, { name: itemName }, 'remove');
      } catch (parentMetadataError) {
          console.warn(`[Server] /delete - Directory deleted, but failed to update parent metadata.json for directory "${parentDirForMeta || '(root)'}":`, parentMetadataError.message);
          // Log warning but proceed with success response for directory deletion itself
      }
      // --- End Update Parent Metadata ---

      console.log(`[Server] /delete - Directory deletion process completed for: "${effectiveItemPath}"`);
      res.status(200).json({ message: `Successfully deleted directory "${itemName}".` }); // Use itemName for user message

    } else if (isFile) {
      // Delete single blob (use original itemPath here as it was confirmed to be a file)
      const blobClientForFile = client.getBlockBlobClient(itemPath);
      const deleteResponse = await blobClientForFile.deleteIfExists();
      if (!deleteResponse.errorCode) {
        console.log(`[Server] /delete - Blob deleted: "${itemPath}"`);

        // --- Update metadata.json in parent directory ---
        try {
            // Ensure directoryPath doesn't become '.' for root level files
            const parentDirForMeta = directoryPath === '.' ? '' : directoryPath;
            await updateMetadataJson(client, parentDirForMeta, { name: itemName }, 'remove');
        } catch (metadataError) {
            console.warn(`[Server] /delete - Blob deleted, but failed to update metadata.json for directory "${directoryPath}":`, metadataError.message);
            // Decide if this should be a partial success or failure. Let's return success but log warning.
        }
        // --- End Update ---

        res.status(200).json({ message: `Successfully deleted "${itemPath}".` });
      } else {
        // This case should be less likely now due to the initial check, but keep for safety
        console.log(`[Server] /delete - Blob not found or error deleting file: "${itemPath}"`, deleteResponse.errorCode);
        res.status(404).json({ message: 'Item not found or could not be deleted.' });
      }
    }
    // No else needed, the initial check handles the "not found" case.

  } catch (error) {
    console.error(`[Server] Error: /delete - Path "${itemPath}":`, error);
    res.status(500).json({ message: 'Failed to delete item.', error: error.message, details: error.code });
  }
};

// --- NEW: Get Download URL ---
export const getDownloadUrl = async (req, res) => {
  const { path: blobPath } = req.query;
  console.log(`[Server /download-url Entry] Path: "${blobPath}"`); // Entry log

  if (!blobPath) {
    console.log('[Server] Error: /download-url - Path required.');
    return res.status(400).json({ message: 'Blob path is required.' });
  }

  try {
    const { client, credential } = ensureClientAndCredentials();
    const blobClient = client.getBlobClient(blobPath); // Get client for the specific blob

    // Check if blob exists (optional but good practice)
    console.log(`[Server /download-url] Checking existence for: "${blobPath}"`); // Log check
    const exists = await blobClient.exists();
    if (!exists) {
        console.log(`[Server /download-url Error] Blob not found: "${blobPath}"`); // Log error
        return res.status(404).json({ message: 'File not found.' });
    }
    console.log(`[Server /download-url] Blob exists: "${blobPath}"`); // Log success

    const sasOptions = {
      containerName: containerName, // Use container name from config
      blobName: blobPath,
      startsOn: new Date(), // Start now
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // Expires in 1 hour
      permissions: BlobSASPermissions.parse("r"), // Read permissions
    };

    console.log(`[Server /download-url] Generating SAS token with options:`, sasOptions); // Log options
    const sasToken = generateBlobSASQueryParameters(sasOptions, credential).toString();
    const sasUrl = `${blobClient.url}?${sasToken}`;

    console.log(`[Server /download-url Exit] SAS URL generated for "${blobPath}"`); // Exit log
    res.status(200).json({ url: sasUrl });

  } catch (error) {
    console.error(`[Server /download-url Error] Path "${blobPath}":`, error); // Error log
    res.status(500).json({ message: 'Failed to generate download URL.', error: error.message, details: error.code });
  }
};

// --- NEW Helper Function to Add Directory Contents Recursively ---
async function addDirectoryToArchive(client, archive, dirAzurePath, dirZipPath) {
  console.log(`[Helper] Adding directory to archive. Azure Path: "${dirAzurePath}", Zip Path: "${dirZipPath}"`);
  const prefix = dirAzurePath.endsWith('/') ? dirAzurePath : `${dirAzurePath}/`;
  let itemCount = 0;

  try {
    const blobs = client.listBlobsFlat({ prefix });
    for await (const blob of blobs) {
      itemCount++;
      const relativePath = blob.name.substring(prefix.length); // Path relative to the directory being zipped
      const zipEntryPath = path.join(dirZipPath, relativePath).replace(/\\/g, '/'); // Path inside the zip file

      console.log(`[Helper] -> Adding file to zip: ${blob.name} as ${zipEntryPath}`);
      try {
        const blobClient = client.getBlobClient(blob.name);
        const downloadResponse = await blobClient.download();

        if (!downloadResponse.readableStreamBody) {
          console.warn(`[Helper] -> Skipping ${blob.name}: No readable stream.`);
          continue;
        }
        // Use pipeline to handle backpressure and errors during streaming
        const passThrough = new stream.PassThrough();
        downloadResponse.readableStreamBody.pipe(passThrough);
        archive.append(passThrough, { name: zipEntryPath });

      } catch (downloadError) {
        console.error(`[Helper] -> Error downloading blob ${blob.name}:`, downloadError);
        // Add an error file to the zip for this specific blob
        archive.append(`Error downloading ${blob.name}: ${downloadError.message || 'Unknown error'}`, { name: path.join(dirZipPath, `ERROR_${relativePath}.txt`).replace(/\\/g, '/') });
      }
    }
    console.log(`[Helper] Finished adding ${itemCount} items from directory "${dirAzurePath}" to zip path "${dirZipPath}".`);
  } catch (listError) {
     console.error(`[Helper] Error listing blobs for directory ${dirAzurePath}:`, listError);
     // Add a general error file for the directory listing failure
     archive.append(`Error listing contents of directory ${dirAzurePath}: ${listError.message || 'Unknown error'}`, { name: path.join(dirZipPath, `ERROR_listing_directory.txt`).replace(/\\/g, '/') });
  }
}
// --- END Helper Function ---

// --- NEW: Download Files as ZIP ---
export const downloadFilesAsZip = async (req, res) => {
  const { paths } = req.body; // Expect an array of blob paths/prefixes
  console.log(`[Server] Request: /download-zip - Paths: ${paths?.length || 0} items`);

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    console.log('[Server] Error: /download-zip - No paths provided.');
    return res.status(400).json({ message: 'An array of item paths is required.' });
  }

  try {
    const client = ensureClient();
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    });

    // Set headers for ZIP download
    // Determine a base name - if only one item, use its name, otherwise generic
    const baseName = paths.length === 1 ? path.basename(paths[0]) : 'download';
    const zipFileName = `${baseName}-${Date.now()}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

    // Pipe the archive stream to the response
    archive.pipe(res);

    // Process each path provided
    for (const itemPath of paths) {
      console.log(`[Server] /download-zip - Processing path: ${itemPath}`);
      try {
        // Check if itemPath likely represents a directory
        // Method 1: Check for placeholder blob (if using that convention)
        // Method 2: More robust - check if listing with prefix returns anything
        let isDirectory = false;
        const prefix = itemPath.endsWith('/') ? itemPath : `${itemPath}/`;
        const iter = client.listBlobsFlat({ prefix });
        const firstItem = await iter.next(); // Check if there's at least one item under the prefix

        if (!firstItem.done) { // If listing returned something, it's a directory
          isDirectory = true;
          console.log(`[Server] /download-zip - Path "${itemPath}" identified as a directory.`);
          // Add the directory contents using the helper
          await addDirectoryToArchive(client, archive, itemPath, path.basename(itemPath));
        } else {
           // If listing returned nothing, check if the path itself exists as a file
           const blobClient = client.getBlobClient(itemPath);
           const exists = await blobClient.exists();
           if (exists) {
               const properties = await blobClient.getProperties();
               // Check if it's NOT a directory placeholder (i.e., it's a file)
               if (properties.metadata?.isDirectoryPlaceholder !== "true") {
                   console.log(`[Server] /download-zip - Path "${itemPath}" identified as a file.`);
                   // Add the single file
                   const downloadResponse = await blobClient.download();
                   if (!downloadResponse.readableStreamBody) {
                       console.warn(`[Server] /download-zip - Skipping file ${itemPath}: No readable stream.`);
                       continue;
                   }
                   // Use pipeline for safety
                   const passThrough = new stream.PassThrough();
                   downloadResponse.readableStreamBody.pipe(passThrough);
                   archive.append(passThrough, { name: path.basename(itemPath) });
               } else {
                   // It exists but IS a directory placeholder - treat as empty directory?
                   // Archiver might create the directory entry automatically if files are added under it.
                   // Or explicitly add an empty directory entry if needed:
                   // archive.append(null, { name: path.basename(itemPath) + '/' });
                   console.log(`[Server] /download-zip - Path "${itemPath}" is an empty directory placeholder. Skipping direct add.`);
               }
           } else {
               console.warn(`[Server] /download-zip - Skipping path "${itemPath}": Does not exist as a file or non-empty directory.`);
           }
        }

      } catch (itemError) {
        console.error(`[Server] /download-zip - Error processing path ${itemPath}:`, itemError);
        archive.append(`Error processing ${itemPath}: ${itemError.message || 'Unknown error'}`, { name: `ERROR_${path.basename(itemPath)}.txt` });
      }
    }

    // Finalize the archive (signals no more files will be appended)
    await archive.finalize();
    console.log(`[Server] Response: /download-zip - ZIP stream finalized.`);

  } catch (error) {
    console.error('[Server] Error: /download-zip - Failed to create zip:', error);
    // If headers haven't been sent, send an error response
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to create ZIP file.', error: error.message });
    } else {
      // If headers were sent, we can't send JSON, just end the response abruptly
      console.error('[Server] Error: /download-zip - Headers already sent, ending response.');
      res.end();
    }
  }
};
// --- END MODIFIED ---

// --- NEW: Move Item (File or Directory) ---
export const moveItem = async (req, res) => {
    const { sourcePath, destinationFolderPath } = req.body;
    console.log(`[Move Item] Request received: Move "${sourcePath}" to folder "${destinationFolderPath}"`);

    if (!sourcePath || destinationFolderPath === undefined || destinationFolderPath === null) { // Allow empty string for root
        return res.status(400).json({ message: 'Source path and destination folder path are required.' });
    }

    try {
        const { client: containerClient } = ensureClientAndCredentials();
        const sourceBlobName = sourcePath; // Assuming sourcePath is the full blob name
        const sourceBlobClient = containerClient.getBlobClient(sourceBlobName);

        // --- 1. Fetch source blob properties and metadata ---
        let sourceProperties;
        let sourceMetadata; // This will hold the blob's direct metadata (key:value strings)
        let sourceMetadataJsonEntry; // This will hold the entry from metadata.json
        const sourceDirectoryPath = path.posix.dirname(sourceBlobName);
        const sourceName = path.posix.basename(sourceBlobName);
        const sourceDirForMeta = sourceDirectoryPath === '.' ? '' : sourceDirectoryPath;

        try {
            sourceProperties = await sourceBlobClient.getProperties();
            sourceMetadata = sourceProperties.metadata || {}; // Use existing blob metadata or empty object
            console.log(`[Move Item] Fetched blob metadata for source: ${sourcePath}`, sourceMetadata);

            // Fetch the corresponding entry from metadata.json
            try {
                const metadataJsonPath = path.posix.join(sourceDirForMeta, 'metadata.json');
                const metadataBlobClient = containerClient.getBlockBlobClient(metadataJsonPath);
                const downloadResponse = await metadataBlobClient.download(0);
                const contentBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
                const existingData = safeJsonParse(contentBuffer.toString());
                if (existingData?.files?.[sourceName]) {
                    sourceMetadataJsonEntry = existingData.files[sourceName];
                    console.log(`[Move Item] Fetched metadata.json entry for source: ${sourceName}`);
                } else {
                    console.warn(`[Move Item] Entry for ${sourceName} not found in ${metadataJsonPath}.`);
                    sourceMetadataJsonEntry = {}; // Use empty object if not found
                }
            } catch (metaJsonError) {
                 if (metaJsonError.statusCode === 404) {
                    console.warn(`[Move Item] metadata.json not found in source dir ${sourceDirForMeta}.`);
                 } else {
                    console.warn(`[Move Item] Error fetching source metadata.json from ${sourceDirForMeta}:`, metaJsonError.message);
                 }
                 sourceMetadataJsonEntry = {}; // Use empty object on error
            }

        } catch (error) {
             if (error.statusCode === 404) {
                console.error(`[Move Item] Error: Source blob "${sourcePath}" not found.`);
                return res.status(404).json({ message: `Source item "${sourcePath}" not found.` });
            }
            throw error; // Re-throw other errors
        }
        // --- End Fetch ---

        // ... existing validation checks (move to same path, move folder into self) ...
        const destinationBlobName = path.posix.join(destinationFolderPath, sourceName);

        // Prevent moving to the exact same path
        if (sourceBlobName === destinationBlobName) {
             console.warn(`[Move Item] Source and destination paths are identical: "${sourceBlobName}". Aborting.`);
             return res.status(400).json({ message: 'Source and destination paths are the same.' });
        }
        // Prevent moving a folder into itself (basic check)
        // Check if source is likely a folder (no content type or placeholder metadata)
        const isSourceLikelyFolder = !sourceProperties.contentType || sourceMetadata?.isDirectoryPlaceholder === "true";
        if (isSourceLikelyFolder && destinationBlobName.startsWith(sourceBlobName + '/')) {
             console.warn(`[Move Item] Attempt to move folder "${sourceBlobName}" into itself. Aborting.`);
             return res.status(400).json({ message: 'Cannot move a folder into itself.' });
        }


        const destinationBlobClient = containerClient.getBlobClient(destinationBlobName);
        const sourceUrl = sourceBlobClient.url;

        console.log(`[Move Item] Starting copy from "${sourceUrl}" to "${destinationBlobName}"`);
        // --- Preserve Metadata during Copy ---
        // The beginCopyFromURL doesn't directly preserve metadata in older SDK versions.
        // We need to set it explicitly after copy or use a newer method if available.
        // For now, we'll set it after copy.
        const copyPoller = await destinationBlobClient.beginCopyFromURL(sourceUrl);
        await copyPoller.pollUntilDone();
        console.log(`[Move Item] Copy completed. Setting metadata on destination.`);
        // Set the original blob metadata on the new blob
        await destinationBlobClient.setMetadata(sourceMetadata);
        console.log(`[Move Item] Metadata set on destination. Deleting source blob: "${sourceBlobName}"`);
        // --- End Preserve Metadata ---

        await sourceBlobClient.delete();
        console.log(`[Move Item] Source blob deleted.`);

        // --- 2. Update metadata.json files ---
        const destinationDirectoryPath = destinationFolderPath; // Already the directory path
        const destDirForMeta = destinationDirectoryPath === '.' ? '' : destinationDirectoryPath;

        try {
            console.log(`[Move Item] Removing metadata entry from source: Dir="${sourceDirForMeta}", Name="${sourceName}"`);
            await updateMetadataJson(containerClient, sourceDirForMeta, { name: sourceName }, 'remove');
        } catch (metaError) {
            console.error(`[Move Item] Failed to remove metadata from source "${sourceDirForMeta}":`, metaError.message);
            // Log error but continue to attempt adding to destination
        }

        try {
            console.log(`[Move Item] Adding metadata entry to destination: Dir="${destDirForMeta}", Name="${sourceName}"`);
            // Use the fetched sourceMetadataJsonEntry
            await updateMetadataJson(containerClient, destDirForMeta, { name: sourceName, metadata: sourceMetadataJsonEntry }, 'update');
        } catch (metaError) {
            console.error(`[Move Item] Failed to add metadata to destination "${destDirForMeta}":`, metaError.message);
            // Log error. The move succeeded, but metadata update failed partially.
        }
        // --- End Update metadata.json ---

        res.status(200).json({ message: `Successfully moved "${sourceName}" to "${destinationFolderPath}". Metadata updated.` });

    } catch (error) {
        // ... existing error handling ...
        console.error(`[Move Item] Error moving item "${sourcePath}":`, error);
        // Provide more specific error messages based on error type if possible
        if (error.statusCode === 404) { // Might occur during delete if copy failed silently or source was already gone
             res.status(404).json({ message: `Operation failed. Source or destination might not exist or access denied.` });
        } else if (error.statusCode === 409) { // Conflict (e.g., destination exists and overwrite not specified/allowed)
             res.status(409).json({ message: `Operation failed. An item with the same name may already exist at the destination.` });
        }
         else {
            res.status(500).json({ message: `Failed to move item: ${error.message}` });
        }
    }
};
// --- End Modify moveItem ---

// --- Controller for Batch Move ---
export const moveItems = async (req, res) => {
    console.log('[Controller /move-batch] Received request body:', JSON.stringify(req.body, null, 2));

    // --- FIX: Expect 'destinationFolderPath' from the request body ---
    const { sourcePaths, destinationFolderPath } = req.body;
    // --- End FIX ---

    // --- Update Validation to use 'destinationFolderPath' ---
    if (!Array.isArray(sourcePaths) || sourcePaths.length === 0 || typeof destinationFolderPath !== 'string') {
        console.error(`[Controller /move-batch] Validation Failed!`);
        console.error(`  typeof sourcePaths: ${typeof sourcePaths}, isArray: ${Array.isArray(sourcePaths)}, length: ${sourcePaths?.length}`);
        // --- FIX: Log the correct variable ---
        console.error(`  typeof destinationFolderPath: ${typeof destinationFolderPath}`);
        // --- End FIX ---
        return res.status(400).json({ message: 'Invalid request body. "sourcePaths" must be a non-empty array and "destinationFolderPath" must be a string.' }); // Update error message slightly if desired
    }
    // --- End Validation Update ---

    // --- FIX: Use 'destinationFolderPath' in logs and function calls ---
    console.log(`[Controller] Received request to move ${sourcePaths.length} items to "${destinationFolderPath}"`);
    console.log('[Controller] Items to move:', sourcePaths);
    // --- End FIX ---

    const results = {
        success: [],
        errors: [],
        totalCopied: 0,
        totalDeleted: 0,
    };

    try {
        const client = ensureClient();

        for (const sourcePath of sourcePaths) {
            try {
                // --- FIX: Pass 'destinationFolderPath' to the helper ---
                console.log(`[Controller] Attempting to move item: "${sourcePath}" to "${destinationFolderPath}"`);
                const stats = await copyOrMoveItemRecursive(client, sourcePath, destinationFolderPath, true);
                // --- End FIX ---

                // Aggregate stats and handle helper errors
                results.totalCopied += stats.copied;
                results.totalDeleted += stats.deleted;

                if (stats.errors && stats.errors.length > 0) {
                    console.warn(`[Controller] Errors moving "${sourcePath}":`, stats.errors);
                    stats.errors.forEach(errMsg => {
                        results.errors.push({
                            path: sourcePath,
                            message: errMsg,
                        });
                    });
                } else if (stats.copied > 0 || stats.deleted > 0) {
                    console.log(`[Controller] Successfully processed move for: "${sourcePath}"`);
                    results.success.push(sourcePath);
                } else {
                    console.warn(`[Controller] No items copied or deleted for "${sourcePath}", potentially source not found or empty.`);
                }

            } catch (error) {
                console.error(`[Controller] Critical error moving item "${sourcePath}":`, error);
                const itemName = sourcePath.includes('/') ? sourcePath.substring(sourcePath.lastIndexOf('/') + 1) : sourcePath;
                results.errors.push({
                    path: sourcePath,
                    message: `Failed to move "${itemName}": ${error.message || 'Unknown error'}`,
                });
                // break; // Optional: stop on first critical error
            }
        }

    } catch (clientError) {
        console.error('[Controller] Failed to get Azure client for move operation:', clientError);
        return res.status(500).json({ message: 'Failed to initialize storage connection.', error: clientError.message });
    }

    // --- Response Handling ---
    if (results.errors.length > 0) {
        const statusCode = results.success.length > 0 ? 207 : 500;
        console.warn(`[Controller] Move operation completed with ${results.errors.length} errors.`);
        return res.status(statusCode).json({
            message: `Move operation completed with ${results.errors.length} error(s).`,
            details: results.errors,
            successCount: results.success.length,
            itemsCopied: results.totalCopied,
            itemsDeleted: results.totalDeleted,
        });
    } else {
        console.log(`[Controller] Successfully moved all ${results.success.length} items. Total copied: ${results.totalCopied}, Total deleted: ${results.totalDeleted}.`);
        return res.status(200).json({
            message: `Successfully moved ${results.success.length} item(s).`,
            movedPaths: results.success,
            itemsCopied: results.totalCopied,
            itemsDeleted: results.totalDeleted,
        });
    }
};

// --- Controller for Batch Copy ---
export const copyItems = async (req, res) => {
  const { sourcePaths, destinationFolderPath } = req.body;
  console.log(`[Server] Request: /copy-batch - ${sourcePaths?.length} items to "${destinationFolderPath}"`);

   if (!sourcePaths || !Array.isArray(sourcePaths) || sourcePaths.length === 0 || typeof destinationFolderPath === 'undefined') {
    return res.status(400).json({ message: 'Source paths array and destination folder path are required.' });
  }

  try {
    const client = ensureClient();
    let totalCopied = 0;
    const errors = [];

    for (const sourcePath of sourcePaths) {
       // Basic check to prevent copying into self/subfolder (less critical for copy but good practice)
       if (destinationFolderPath.startsWith(sourcePath + '/')) {
           console.warn(`[Server] /copy-batch - Skipping copy of ${sourcePath} into its own subfolder ${destinationFolderPath}`);
           errors.push(`Cannot copy ${path.basename(sourcePath)} into its own subfolder.`);
           continue;
       }

      try {
        // --- NEW: Check if it's a copy to the same directory and handle renaming ---
        const sourceDir = path.posix.dirname(sourcePath);
        const sourceName = path.posix.basename(sourcePath);
        let targetDestinationPath = destinationFolderPath;
        let newName = null;
        
        if (sourceDir === destinationFolderPath) {
            // It's a copy within the same directory, generate a new name
            console.log(`[Server] /copy-batch - Same directory copy detected for ${sourceName}`);
            
            // Check if blob exists to generate an appropriate name
            const blobClient = client.getBlobClient(sourcePath);
            if (await blobClient.exists()) {
                // Extract base name and extension
                const lastDotIndex = sourceName.lastIndexOf('.');
                const baseName = lastDotIndex !== -1 ? sourceName.substring(0, lastDotIndex) : sourceName;
                const extension = lastDotIndex !== -1 ? sourceName.substring(lastDotIndex) : '';
                
                // Try with " - Copy" suffix, then " - Copy (2)", etc. until we find a unique name
                let counter = 1;
                let candidateName = `${baseName} - Copy${extension}`;
                
                while (true) {
                    const candidatePath = path.posix.join(destinationFolderPath, candidateName);
                    const candidateClient = client.getBlobClient(candidatePath);
                    if (!(await candidateClient.exists())) {
                        break; // Found an unused name
                    }
                    
                    // Try next counter value
                    counter++;
                    candidateName = `${baseName} - Copy (${counter})${extension}`;
                }
                
                newName = candidateName;
                console.log(`[Server] /copy-batch - Generated new name for same-dir copy: ${newName}`);
            }
        }
        // --- END NEW ---
        
        const stats = await copyOrMoveItemRecursive(client, sourcePath, targetDestinationPath, false, newName); // false = don't deleteSource
        totalCopied += stats.copied;
      } catch (error) {
        console.error(`[Server] /copy-batch - Error copying item ${sourcePath}:`, error);
        errors.push(`Failed to copy ${path.basename(sourcePath)}: ${error.message}`);
      }
    }

     if (errors.length > 0) {
        const message = `Copy operation completed with ${errors.length} error(s). ${totalCopied} items created.`;
        console.log(`[Server] Response: /copy-batch - ${message}`);
        res.status(207).json({ message, errors, copied: totalCopied });
    } else {
        const message = `Successfully copied ${sourcePaths.length} item(s). ${totalCopied} items created.`;
        console.log(`[Server] Response: /copy-batch - ${message}`);
        res.status(200).json({ message, copied: totalCopied });
    }

  } catch (error) {
    console.error('[Server] Error: /copy-batch - General failure:', error);
    res.status(500).json({ message: 'Failed to process batch copy.', error: error.message });
  }
};

// --- NEW: Rename Item ---
export const renameItem = async (req, res) => {
  const { originalPath, newPath } = req.body;
  console.log(`[Server /rename Entry] From "${originalPath}" To "${newPath}"`); // Entry log

  // --- Validation ---
  if (!originalPath || !newPath) {
    return res.status(400).json({ message: 'Original and new paths are required.' });
  }
  // Handle potential trailing slashes for directory determination
  const effectiveOriginalPath = originalPath.endsWith('/') ? originalPath.slice(0, -1) : originalPath;
  const effectiveNewPath = newPath.endsWith('/') ? newPath.slice(0, -1) : newPath;

  const originalDir = path.posix.dirname(effectiveOriginalPath);
  const newDir = path.posix.dirname(effectiveNewPath);
  const originalName = path.posix.basename(effectiveOriginalPath);
  const newName = path.posix.basename(effectiveNewPath);
  const dirForMetadata = originalDir === '.' ? '' : originalDir; // Handle root

  if (originalDir !== newDir) {
    console.error(`[Server /rename Validation] Failed: Rename must occur within the same directory. Old: ${originalDir}, New: ${newDir}`);
    return res.status(400).json({ message: 'Rename must occur within the same directory.' });
  }
  if (!newName || newName.includes('/') || newName.startsWith('.') || newName.endsWith('.')) {
     return res.status(400).json({ message: `Invalid new name provided: "${newName}". Name cannot contain '/', start or end with '.'` });
  }
  // --- End Validation ---

  try {
    const client = ensureClient();

    // --- Get Metadata Before Operation ---
    let originalMetadataJsonEntry = {}; // Store the full metadata object from metadata.json
    const metadataJsonPath = path.posix.join(dirForMetadata, 'metadata.json');
    try {
        const metadataBlobClient = client.getBlockBlobClient(metadataJsonPath);
        const downloadResponse = await metadataBlobClient.download(0);
        const contentBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
        const existingData = safeJsonParse(contentBuffer.toString());
        // Check if it's in files or folders (handle directory rename if needed later)
        if (existingData?.files?.[originalName]) {
            originalMetadataJsonEntry = existingData.files[originalName]; // Get the specific entry
            console.log(`[Server /rename] Fetched metadata entry for source file: ${originalName} from ${metadataJsonPath}`);
        } else if (existingData?.folders?.[originalName]) {
             originalMetadataJsonEntry = existingData.folders[originalName]; // Get folder entry
             console.log(`[Server /rename] Fetched metadata entry for source folder: ${originalName} from ${metadataJsonPath}`);
        } else {
             console.warn(`[Server /rename] Metadata entry for ${originalName} not found in ${metadataJsonPath}. Proceeding without it.`);
        }
    } catch (propError) {
        if (propError.statusCode === 404) {
             console.warn(`[Server /rename] metadata.json not found at ${metadataJsonPath}. Proceeding without source metadata.`);
        } else {
            console.warn(`[Server /rename] Could not fetch source metadata.json from ${metadataJsonPath}:`, propError.message);
            // Proceed without metadata? Or fail? Let's proceed but log.
        }
    }
    // --- End Get Metadata ---


    const destinationClient = client.getBlobClient(newPath); // Check full new path for conflict
    const destExists = await destinationClient.exists();
    if (destExists) {
        console.error(`[Server /rename Conflict] Destination path "${newPath}" already exists.`);
        return res.status(409).json({ message: `An item named "${newName}" already exists in this directory.` });
    }

    // --- Call recursive helper with newName ---
    console.log(`[Server /rename] Calling copyOrMoveItemRecursive. Source: ${originalPath}, DestDir: ${originalDir}, Delete: true, NewName: ${newName}`);
    const stats = await copyOrMoveItemRecursive(client, originalPath, originalDir, true, newName);
    console.log(`[Server /rename] copyOrMoveItemRecursive completed. Stats:`, stats);
    // --- End Call ---

    // Check stats for errors from copy/delete part
    if (stats.errors && stats.errors.length > 0) {
        console.error(`[Server /rename] Rename failed during copy/delete phase:`, stats.errors);
        // Return error immediately if copy/delete failed
        return res.status(stats.copied > 0 || stats.deleted > 0 ? 207 : 500).json({
            message: `Rename failed during copy/delete with ${stats.errors.length} error(s).`,
            errors: stats.errors,
            copied: stats.copied,
            deleted: stats.deleted
        });
    }

    // --- Update Metadata ---
    // Only proceed if copy/delete was successful (stats.errors is empty)
    if (stats.copied > 0 || stats.deleted > 0) { // Ensure something was actually processed
        try {
            // Remove old entry (works for both file/folder if updateMetadataJson checks both)
            console.log(`[Server /rename Metadata] Removing old entry: Dir='${dirForMetadata}', Name='${originalName}'`);
            await updateMetadataJson(client, dirForMetadata, { name: originalName }, 'remove');

            // Add new entry (using fetched original metadata.json entry)
            console.log(`[Server /rename Metadata] Adding new entry: Dir='${dirForMetadata}', Name='${newName}', Metadata='${JSON.stringify(originalMetadataJsonEntry)}'`);
            await updateMetadataJson(client, dirForMetadata, { name: newName, metadata: originalMetadataJsonEntry }, 'update');

            console.log(`[Server /rename Metadata] Metadata update calls completed.`);
        } catch (metadataError) {
            console.warn(`[Server /rename Metadata] Rename successful, but failed to update metadata.json:`, metadataError.message);
            // Return success but include a warning in the response
            return res.status(200).json({ message: `Successfully renamed "${originalName}" to "${newName}". Metadata update may have failed.` });
        }
    } else {
         console.warn(`[Server /rename] No items were copied or deleted for "${originalPath}". Skipping metadata update.`);
         // This might indicate the source didn't exist, return 404?
         return res.status(404).json({ message: 'Original item not found or was empty.' });
    }
    // --- End Update Metadata ---

    console.log(`[Server /rename Exit] Successfully renamed "${originalName}" to "${newName}"`); // Exit log
    res.status(200).json({ message: `Successfully renamed "${originalName}" to "${newName}".` });

  } catch (error) {
    // ... existing error handling ...
    console.error(`[Server /rename Error] From "${originalPath}" To "${newPath}":`, error); // Error log
    if (error.message?.includes('Source item not found')) {
        return res.status(404).json({ message: 'Original item not found.' });
    }
    res.status(500).json({ message: 'Failed to rename item.', error: error.message, details: error.code });
  }
};

// --- NEW: Get Item Properties ---
export const getItemProperties = async (req, res) => {
    const itemPath = req.query.path;
    console.log(`[Server] Request: /properties - Path: "${itemPath}"`);

    if (!itemPath) {
        return res.status(400).json({ message: 'Item path is required.' });
    }

    try {
        const client = ensureClient();
        const blobClient = client.getBlobClient(itemPath);
        const properties = await blobClient.getProperties();

        // Determine if it's a directory placeholder
        const isDirectory = properties.metadata?.isDirectoryPlaceholder === "true";

        // Construct response object (map SDK response to your desired format)
        const responseData = {
            name: path.basename(itemPath),
            path: itemPath,
            isDirectory: isDirectory,
            size: isDirectory ? undefined : properties.contentLength, // Size irrelevant for placeholder
            createdOn: properties.createdOn,
            lastModified: properties.lastModified,
            contentType: isDirectory ? 'inode/directory' : properties.contentType,
            etag: properties.etag,
            metadata: properties.metadata || {},
            // Add other properties as needed from 'properties' object
        };

        console.log(`[Server] Response: /properties - Found properties for "${itemPath}"`);
        res.status(200).json(responseData);

    } catch (error) {
        console.error(`[Server] Error: /properties - Path "${itemPath}":`, error);
        if (error.statusCode === 404) {
            return res.status(404).json({ message: 'Item not found.' });
        }
        res.status(500).json({ message: 'Failed to get item properties.', error: error.message, details: error.code });
    }
};

// --- NEW: Get Metadata JSON Content ---
export const getMetadataJson = async (req, res) => {
    const { path: metadataPath } = req.query; // Expecting path like 'folder/subfolder/metadata.json'
    console.log(`[Server] Request: /metadata - Path: "${metadataPath}"`);

    if (!metadataPath || !metadataPath.endsWith('metadata.json')) {
        console.log('[Server] Error: /metadata - Invalid or missing path.');
        return res.status(400).json({ message: 'Valid path to metadata.json is required.' });
    }

    try {
        const client = ensureClient();
        const blobClient = client.getBlockBlobClient(metadataPath);

        const exists = await blobClient.exists();
        if (!exists) {
            console.log(`[Server] Error: /metadata - Not found: "${metadataPath}"`);
            // Return empty object or 404? Let's return 404 for clarity.
            return res.status(404).json({ message: 'Metadata file not found.' });
        }

        const downloadResponse = await blobClient.download(0);
        if (!downloadResponse.readableStreamBody) {
             console.error(`[Server] Error: /metadata - Failed to get readable stream for "${metadataPath}"`);
             return res.status(500).json({ message: 'Failed to read metadata file stream.' });
        }

        const contentBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
        const contentString = contentBuffer.toString('utf-8'); // Specify encoding

        // Attempt to parse to ensure it's valid JSON before sending
        try {
            const jsonData = JSON.parse(contentString);
            console.log(`[Server] Response: /metadata - Successfully retrieved and parsed "${metadataPath}"`);
            res.status(200).json(jsonData); // Send parsed JSON
        } catch (parseError) {
             console.error(`[Server] Error: /metadata - Failed to parse JSON content from "${metadataPath}":`, parseError);
             // Send the raw string if parsing fails but file was read? Or send error?
             // Sending error is safer as client expects JSON.
             res.status(500).json({ message: 'Failed to parse metadata file content.', error: parseError.message });
        }

    } catch (error) {
        console.error(`[Server] Error: /metadata - Path "${metadataPath}":`, error);
        res.status(500).json({ message: 'Failed to retrieve metadata file.', error: error.message, details: error.code });
    }
};
// --- END NEW ---

// --- NEW: Update Blob Metadata ---
export const updateBlobMetadata = async (req, res) => {
    const { blobPath, metadata: metadataString } = req.body;
    console.log(`[Server] Request: /update-metadata - Path: "${blobPath}"`);

    if (!blobPath || !metadataString) {
        return res.status(400).json({ message: 'Blob path and metadata are required.' });
    }

    let clientMetadata = safeJsonParse(metadataString);
    if (!clientMetadata) {
        return res.status(400).json({ message: 'Invalid metadata format provided.' });
    }

    try {
        const client = ensureClient();
        const blobClient = client.getBlockBlobClient(blobPath);

        // 1. Check if blob exists
        const exists = await blobClient.exists();
        if (!exists) {
            console.log(`[Server] /update-metadata - Blob not found: "${blobPath}"`);
            return res.status(404).json({ message: 'Blob not found.' });
        }

        // 2. Get existing properties (especially contentType)
        console.log(`[Server] /update-metadata - Fetching existing properties for: "${blobPath}"`);
        const existingProperties = await blobClient.getProperties();
        const existingContentType = existingProperties.contentType;
        console.log(`[Server] /update-metadata - Existing ContentType: "${existingContentType}"`);

        // 3. Prepare new Azure-compatible metadata (similar to upload)
        // Ensure documentId is present or generated if missing (should ideally exist)
        let documentId = clientMetadata.documentId || existingProperties.metadata?.documentid;
        if (!documentId) {
             // This case is less likely if metadata is edited from existing, but handle defensively
             documentId = crypto.randomUUID();
             clientMetadata.documentId = documentId;
             console.warn(`[Server] /update-metadata - Generated new Document ID during update: ${documentId}`);
        } else {
             clientMetadata.documentId = documentId; // Ensure it's in the object going to metadata.json
        }

        const blobMetadata = {
            documentid: documentId,
            documenttype: clientMetadata.documentType || '',
            level: clientMetadata.level || '',
            language: clientMetadata.language || '',
            tags: clientMetadata.tags?.join(',') || '',
            topics: clientMetadata.topics?.join(',') || '',
            accesslevel: clientMetadata.accessLevel || '',
            filetype: clientMetadata.fileType || '',
            country: clientMetadata.country || '',
            jurisdiction: clientMetadata.jurisdiction || '',
            license: clientMetadata.license || '',
            entitiesmentioned: clientMetadata.entitiesMentioned?.join(',') || '',
            collection: clientMetadata.collection || '',
            // Keep originalfilename if it exists in existing metadata, otherwise use client's if provided
            originalfilename: existingProperties.metadata?.originalfilename || clientMetadata.originalFilename || path.basename(blobPath),
        };
        const filteredBlobMetadata = Object.entries(blobMetadata)
            .filter(([_, value]) => value !== '')
            .reduce((obj, [key, value]) => {
                obj[key] = value;
                return obj;
            }, {});
        console.log(`[Server] /update-metadata - Prepared metadata for Azure:`, filteredBlobMetadata);


        // 4. Set metadata, PRESERVING contentType
        console.log(`[Server] /update-metadata - Setting metadata on blob, preserving ContentType: "${existingContentType}"`);
        await blobClient.setMetadata(filteredBlobMetadata, {
            blobHTTPHeaders: { blobContentType: existingContentType } // Preserve existing content type
        });
        console.log(`[Server] /update-metadata - Successfully set metadata on blob: "${blobPath}"`);

        // 5. Update metadata.json in the parent directory
        const parentDirectory = path.posix.dirname(blobPath);
        const fileName = path.posix.basename(blobPath);
        const dirForMetadata = parentDirectory === '.' ? '' : parentDirectory;

        if (fileName && fileName !== '.') {
            const fileMetadataEntry = {
                name: fileName,
                metadata: clientMetadata, // Store the full, potentially updated, client-side metadata object
            };
            console.log(`[Server] /update-metadata - Triggering metadata.json update for file '${fileName}' in directory: '${dirForMetadata || '(root)'}'`);
            await updateMetadataJson(client, dirForMetadata, fileMetadataEntry, 'update');
        } else {
            console.warn(`[Server] /update-metadata - Could not determine filename/parent dir. Skipping metadata.json update.`);
        }

        console.log(`[Server] Response: /update-metadata - Success for "${blobPath}"`);
        res.status(200).json({ message: 'Blob metadata updated successfully.' });

    } catch (error) {
        console.error(`[Server] Error: /update-metadata - Path "${blobPath}":`, error);
        if (error.statusCode === 404) { // Might occur during getProperties if blob deleted concurrently
             return res.status(404).json({ message: 'Blob not found during update process.' });
        }
        res.status(500).json({ message: 'Failed to update blob metadata.', error: error.message, details: error.code });
    }
};
// --- END NEW ---

// --- Helper function for recursive copy/move ---
// Add newName as an optional parameter
async function copyOrMoveItemRecursive(sourceClient, sourcePath, destinationFolderPath, deleteSource, newName = null) {
    const operation = deleteSource ? 'move' : 'copy';
    // Use the newName for logging if provided (rename scenario)
    const effectiveSourceName = newName ? path.basename(sourcePath) : sourcePath;
    const effectiveDestName = newName ? newName : path.basename(sourcePath);
    console.log(`[Helper] ${operation}Recursive: Source "${effectiveSourceName}", DestFolder "${destinationFolderPath}", NewName: "${newName || 'N/A'}"`);

    // --- Add Logging ---
    console.log(`[Helper] Checking existence for source blob client path: "${sourcePath}"`);
    // --- End Logging ---
    const sourceBlobClient = sourceClient.getBlobClient(sourcePath);
    let sourceExists = await sourceBlobClient.exists();
    let isDirectory = false;
    let sourceProperties;

    // --- Add Logging ---
    console.log(`[Helper] Source "${sourcePath}" exists as blob: ${sourceExists}`);
    // --- End Logging ---

    if (sourceExists) {
        sourceProperties = await sourceBlobClient.getProperties();
        if (sourceProperties.metadata?.isDirectoryPlaceholder === "true") {
            isDirectory = true;
            console.log(`[Helper] Source "${sourcePath}" identified as directory placeholder.`);
        } else {
            // Exists and not a placeholder, treat as file unless prefix check says otherwise
            console.log(`[Helper] Source "${sourcePath}" exists as a blob, likely a file.`);
        }
    }

    // Robustness check: Even if it doesn't exist as a single blob, check if it's a directory prefix
    if (!isDirectory) {
        const prefixToCheck = sourcePath.endsWith('/') ? sourcePath : `${sourcePath}/`;
        const iter = sourceClient.listBlobsByHierarchy('/', { prefix: prefixToCheck });
        const firstItem = await iter.next();
        if (!firstItem.done) {
            isDirectory = true;
            console.log(`[Helper] Source "${sourcePath}" identified as directory by prefix contents.`);
            // If it exists as a prefix but not as a blob, sourceExists should be false for placeholder deletion logic
            if (!sourceExists) {
                 console.log(`[Helper] Source "${sourcePath}" exists as prefix but not as placeholder blob.`);
            }
        }
    }

    // If neither blob nor prefix exists, throw error
    if (!sourceExists && !isDirectory) {
        console.error(`[Helper] Source item not found: "${sourcePath}"`);
        throw new Error(`Source item not found: ${sourcePath}`);
    }


    // --- Stats ---
    let stats = { copied: 0, deleted: 0, errors: [] };

    // --- Destination Base Path Construction ---
    // If renaming, the base destination is the target folder + new name
    // Otherwise, it's the target folder + original name
    const destinationBasePath = path.posix.join(destinationFolderPath, effectiveDestName); // Use posix.join
    console.log(`[Helper] Destination Base Path: "${destinationBasePath}"`);
    // --- End Destination Base Path ---

    // --- NEW: Track items for metadata updates ---
    const processedItems = [];
    // --- END NEW ---

    if (isDirectory) {
        // --- Create destination directory placeholder if needed ---
        const destDirPlaceholder = destinationBasePath.endsWith('/') ? destinationBasePath : `${destinationBasePath}/`; // Ensure trailing slash
        try {
            const destDirClient = sourceClient.getBlockBlobClient(destDirPlaceholder);
            const destDirExists = await destDirClient.exists();
            if (!destDirExists) {
                await destDirClient.uploadData(Buffer.alloc(0), { metadata: { isDirectoryPlaceholder: "true" } });
                console.log(`[Helper] Created destination directory placeholder ${destDirPlaceholder}`);
            }
        } catch (e) {
            console.error(`[Helper] Error creating destination directory placeholder ${destDirPlaceholder}:`, e);
            stats.errors.push(`Failed to create destination folder ${effectiveDestName}`);
            return stats; // Stop if we can't create the destination folder structure
        }
        // --- End Create ---

        // List blobs under the source directory prefix
        const sourcePrefix = sourcePath.endsWith('/') ? sourcePath : `${sourcePath}/`;
        console.log(`[Helper] Listing blobs with prefix: "${sourcePrefix}"`);
        const iter = sourceClient.listBlobsFlat({ prefix: sourcePrefix });

        for await (const blob of iter) {
            // Calculate relative path within the source directory
            const relativePath = blob.name.substring(sourcePrefix.length);
            // Construct destination blob name using the destinationBasePath
            const destinationBlobName = path.posix.join(destinationBasePath, relativePath).replace(/\\/g, '/'); // Ensure forward slashes

            console.log(`[Helper] Copying ${blob.name} to ${destinationBlobName}`);
            const destBlobClient = sourceClient.getBlobClient(destinationBlobName);
            const sourceBlobUrl = `${sourceClient.url}/${encodeURIComponent(blob.name)}`; // Use full URL for source

            try {
                // Fetch source metadata to preserve it
                const currentSourceBlobClient = sourceClient.getBlobClient(blob.name);
                const currentSourceProps = await currentSourceBlobClient.getProperties();
                const currentSourceMetadata = currentSourceProps.metadata || {};

                const poller = await destBlobClient.beginCopyFromURL(sourceBlobUrl);
                await poller.pollUntilDone();
                // Set metadata after copy
                await destBlobClient.setMetadata(currentSourceMetadata);
                stats.copied++;

                // --- Add tracking of processed item ---
                processedItems.push({
                    sourcePath: blob.name,
                    destinationPath: destinationBlobName
                });
                // --- End tracking ---

                if (deleteSource) {
                    console.log(`[Helper] Deleting original ${blob.name}`);
                    await sourceClient.deleteBlob(blob.name);
                    stats.deleted++;
                }
            } catch (copyError) {
                console.error(`[Helper] Error ${operation}ing ${blob.name} to ${destinationBlobName}:`, copyError);
                stats.errors.push(`Failed to ${operation} ${blob.name}`);
            }
        }

        // If deleting source, attempt to delete the original directory placeholder (if it existed as a blob)
        if (deleteSource && sourceExists && sourceProperties?.metadata?.isDirectoryPlaceholder === "true") {
             try {
                 console.log(`[Helper] Deleting original directory placeholder ${sourcePath}`);
                 await sourceBlobClient.delete(); // Delete the placeholder blob
                 // stats.deleted++; // Maybe don't count placeholder? Or adjust logic.
             } catch (deleteError) {
                 // Ignore if not found, might have been deleted already
                 if (deleteError.statusCode !== 404) {
                     console.error(`[Helper] Error deleting source directory placeholder ${sourcePath}:`, deleteError);
                     stats.errors.push(`Failed to delete source folder placeholder ${path.basename(sourcePath)}`);
                 }
             }
        }

    } else { // It's a file
        console.log(`[Helper] Copying file ${sourcePath} to ${destinationBasePath}`);
        const destBlobClient = sourceClient.getBlobClient(destinationBasePath); // Destination is just the base path
        const sourceBlobUrl = `${sourceClient.url}/${encodeURIComponent(sourcePath)}`;

        try {
            // Fetch source metadata to preserve it
            const currentSourceMetadata = sourceProperties?.metadata || {};

            const poller = await destBlobClient.beginCopyFromURL(sourceBlobUrl);
            await poller.pollUntilDone();
            // Set metadata after copy
            await destBlobClient.setMetadata(currentSourceMetadata);
            stats.copied++;

            // --- Add tracking of processed item ---
            processedItems.push({
                sourcePath: sourcePath,
                destinationPath: destinationBasePath
            });
            // --- End tracking ---

            if (deleteSource) {
                console.log(`[Helper] Deleting original file ${sourcePath}`);
                await sourceBlobClient.delete();
                stats.deleted++;
            }
        } catch (copyError) {
            console.error(`[Helper] Error ${operation}ing file ${sourcePath} to ${destinationBasePath}:`, copyError);
            stats.errors.push(`Failed to ${operation} file ${path.basename(sourcePath)}`);
        }
    }

    // --- NEW: Handle metadata.json updates for moved/copied items ---
    if (processedItems.length > 0) {
        console.log(`[Helper] Updating metadata.json files for ${processedItems.length} ${deleteSource ? 'moved' : 'copied'} items`);
        
        // Group by source and destination directories for efficient metadata.json updates
        const sourceDirectories = new Map();
        const destDirectories = new Map();
        
        for (const item of processedItems) {
            const sourceDir = path.posix.dirname(item.sourcePath);
            const sourceName = path.posix.basename(item.sourcePath);
            const destDir = path.posix.dirname(item.destinationPath);
            
            // Convert directory path to our standard format (empty string for root)
            const sourceDirForMeta = sourceDir === '.' ? '' : sourceDir;
            const destDirForMeta = destDir === '.' ? '' : destDir;
            
            // Group by directories
            if (deleteSource) { // Only track source directories for removal if we're moving (not copying)
                if (!sourceDirectories.has(sourceDirForMeta)) {
                    sourceDirectories.set(sourceDirForMeta, []);
                }
                sourceDirectories.get(sourceDirForMeta).push(sourceName);
            }
            
            if (!destDirectories.has(destDirForMeta)) {
                destDirectories.set(destDirForMeta, []);
            }
            
            // Now fetch metadata for this specific item from source directory
            try {
                // Try to get metadata from the original item for the destination update
                const metadataJsonPath = path.posix.join(sourceDirForMeta, 'metadata.json');
                const metadataBlobClient = sourceClient.getBlockBlobClient(metadataJsonPath);
                
                if (await metadataBlobClient.exists()) {
                    const downloadResponse = await metadataBlobClient.download(0);
                    const contentBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
                    const metadataJson = safeJsonParse(contentBuffer.toString());
                    
                    if (metadataJson && (metadataJson.files?.[sourceName] || metadataJson.folders?.[sourceName])) {
                        const itemMetadata = metadataJson.files?.[sourceName] || metadataJson.folders?.[sourceName] || {};
                        const isFolder = !metadataJson.files?.[sourceName] && metadataJson.folders?.[sourceName];
                        
                        // Store the item with its metadata in the destination directory group
                        destDirectories.get(destDirForMeta).push({
                            name: path.posix.basename(item.destinationPath),
                            metadata: itemMetadata,
                            isFolder: isFolder
                        });
                    } else {
                        // No metadata found for this item, still need to include in destination
                        destDirectories.get(destDirForMeta).push({
                            name: path.posix.basename(item.destinationPath),
                            metadata: {},
                            isFolder: sourceName.endsWith('/') // Basic folder detection
                        });
                    }
                } else {
                    // No metadata.json found in source dir, still add basic entry to destination
                    destDirectories.get(destDirForMeta).push({
                        name: path.posix.basename(item.destinationPath),
                        metadata: {},
                        isFolder: sourceName.endsWith('/') // Basic folder detection
                    });
                }
            } catch (metadataError) {
                console.warn(`[Helper] Error getting metadata for ${item.sourcePath}: ${metadataError.message}`);
                // Still add basic entry to destination
                destDirectories.get(destDirForMeta).push({
                    name: path.posix.basename(item.destinationPath),
                    metadata: {},
                    isFolder: sourceName.endsWith('/') // Basic folder detection
                });
            }
        }
        
        // Process source directories - remove entries (only for move operations)
        if (deleteSource) {
            for (const [dir, items] of sourceDirectories.entries()) {
                for (const itemName of items) {
                    try {
                        console.log(`[Helper] Removing metadata for "${itemName}" from directory "${dir || '(root)'}""`);
                        await updateMetadataJson(sourceClient, dir, { name: itemName }, 'remove');
                    } catch (metaError) {
                        console.warn(`[Helper] Failed to remove metadata for ${itemName} from ${dir}: ${metaError.message}`);
                        // Continue with other items
                    }
                }
            }
        }
        
        // Process destination directories - add entries (for both copy and move)
        for (const [dir, items] of destDirectories.entries()) {
            for (const item of items) {
                try {
                    console.log(`[Helper] Adding metadata for "${item.name}" to directory "${dir || '(root)'}""`);
                    await updateMetadataJson(sourceClient, dir, item, 'update');
                } catch (metaError) {
                    console.warn(`[Helper] Failed to add metadata for ${item.name} to ${dir}: ${metaError.message}`);
                    // Continue with other items
                }
            }
        }
    }
    // --- END NEW: Handle metadata.json updates ---

    return stats;
}
// --- End Helper function ---

// --- NEW: Check if Directory is Empty and Delete if Empty ---
export const checkAndDeleteEmptyDirectory = async (req, res) => {
    const { path: directoryPath } = req.query;
    console.log(`[Server] Request: /check-empty-directory - Path: "${directoryPath}"`);

    if (!directoryPath) {
        return res.status(400).json({ message: 'Directory path is required.' });
    }

    try {
        const client = ensureClient();
        
        // Use the helper from metadataHelper
        const result = await checkAndDeleteEmptyDirectory(client, directoryPath);
        
        if (result) {
            console.log(`[Server] Response: /check-empty-directory - Directory "${directoryPath}" was empty and deleted.`);
            res.status(200).json({ message: 'Directory was empty and deleted successfully.', deleted: true });
        } else {
            console.log(`[Server] Response: /check-empty-directory - Directory "${directoryPath}" was not empty or deletion was skipped.`);
            res.status(200).json({ message: 'Directory was not empty or deletion was skipped.', deleted: false });
        }
    } catch (error) {
        console.error(`[Server] Error: /check-empty-directory - Path "${directoryPath}":`, error);
        res.status(500).json({ message: 'Failed to check or delete directory.', error: error.message });
    }
};
// ... existing code ...
