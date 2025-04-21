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
const updateMetadataJson = async (containerClient, directoryPath, fileMetadataEntry) => {
    if (!fileMetadataEntry || !fileMetadataEntry.name || !fileMetadataEntry.metadata) {
        console.warn(`[Metadata Helper] Skipping update in "${directoryPath || '(root)'}": Invalid fileMetadataEntry.`);
        return;
    }

    const metadataFileName = path.posix.join(directoryPath, 'metadata.json');
    const blobClient = containerClient.getBlockBlobClient(metadataFileName);
    let metadataJson = { files: {}, folders: {} };
    let currentEtag = undefined; // Variable to store the ETag

    console.log(`[Metadata Helper] Attempting to update: ${metadataFileName}`);

    try {
        // Try to download existing metadata and get ETag
        const downloadResponse = await blobClient.download(0); // Download from beginning
        currentEtag = downloadResponse.etag; // Store the ETag
        const contentBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
        const existingData = safeJsonParse(contentBuffer.toString());

        if (existingData) {
            metadataJson = existingData;
            metadataJson.files = metadataJson.files || {};
            metadataJson.folders = metadataJson.folders || {};
            console.log(`[Metadata Helper] Found existing metadata.json in "${directoryPath || '(root)'}" with ETag: ${currentEtag}`);
        } else {
             console.warn(`[Metadata Helper] Existing metadata.json in "${directoryPath || '(root)'}" is invalid. Overwriting.`);
             currentEtag = undefined; // Treat as if it didn't exist for upload condition
        }
    } catch (error) {
        if (error.statusCode === 404) {
            console.log(`[Metadata Helper] No existing metadata.json found in "${directoryPath || '(root)'}". Creating new one.`);
            currentEtag = undefined; // No ETag for new file
        } else {
            console.error(`[Metadata Helper] Error downloading metadata.json from "${directoryPath || '(root)'}":`, error);
            // Decide if you want to proceed or throw error - let's proceed but log
        }
    }

    // Add/Update the file entry
    metadataJson.files[fileMetadataEntry.name] = fileMetadataEntry.metadata;

    // Upload the updated metadata.json with ETag condition
    try {
        const content = JSON.stringify(metadataJson, null, 2);
        const uploadOptions = {
            blobHTTPHeaders: { blobContentType: 'application/json' },
            // --- Add ETag condition ---
            conditions: currentEtag ? { ifMatch: currentEtag } : undefined
            // --- End ETag condition ---
        };
        await blobClient.upload(content, content.length, uploadOptions);
        console.log(`[Metadata Helper] Successfully updated ${metadataFileName}`);
    } catch (uploadError) {
        if (uploadError.statusCode === 412) { // Precondition Failed (ETag mismatch)
             console.warn(`[Metadata Helper] ETag mismatch for ${metadataFileName}. Concurrent update likely occurred. Consider retrying.`);
             // Optionally: Implement retry logic here (read again, merge changes, try upload again)
             throw new Error(`Failed to update metadata.json due to concurrent modification. Please try again.`);
        } else {
            console.error(`[Metadata Helper] Error uploading updated ${metadataFileName}:`, uploadError);
            throw uploadError; // Re-throw other errors
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
    const client = ensureClient();
    const items = [];
    const prefix = directoryPath ? `${directoryPath}/` : '';
    const iterator = client.listBlobsByHierarchy('/', { prefix });

    for await (const item of iterator) {
      const isDirectory = item.kind === 'prefix';
      const itemName = isDirectory 
        ? item.name.substring(prefix.length).replace(/\/$/, '') 
        : item.name.substring(prefix.length);
      
      if (!itemName) continue; // Skip empty names

      const itemPath = isDirectory ? item.name.replace(/\/$/, '') : item.name;

      items.push({
        id: itemPath,
        name: itemName,
        path: itemPath,
        isDirectory: isDirectory,
        size: isDirectory ? 0 : item.properties?.contentLength || 0,
        lastModified: isDirectory ? new Date() : item.properties?.lastModified || new Date(),
        contentType: isDirectory ? 'inode/directory' : item.properties?.contentType || 'application/octet-stream',
        metadata: item.metadata || {},
      });
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
    console.log('[Server] Error: /delete - Path required.');
    return res.status(400).json({ message: 'Item path is required.' });
  }
  try {
    const client = ensureClient();
    // Check if it's likely a directory (ends with / or has items underneath)
    let isDirectory = itemPath.endsWith('/');
    if (!isDirectory) {
      const iter = client.listBlobsByHierarchy('/', { prefix: `${itemPath}/` });
      if (!(await iter.next()).done) isDirectory = true;
    }

    if (isDirectory) {
      const dirPrefix = itemPath.endsWith('/') ? itemPath : `${itemPath}/`;
      console.log(`[Server] /delete - Deleting directory prefix: ${dirPrefix}`);
      const blobs = client.listBlobsFlat({ prefix: dirPrefix });
      let count = 0;
      for await (const blob of blobs) {
        await client.deleteBlob(blob.name);
        count++;
      }
      try { await client.deleteBlob(dirPrefix); } // Attempt delete placeholder
      catch (e) { if (e.statusCode !== 404) console.warn(`Could not delete placeholder ${dirPrefix}: ${e.message}`); }
      console.log(`[Server] Response: /delete - Directory deleted (${count} blobs). Path: "${itemPath}"`);
      res.status(200).json({ message: `Directory "${itemPath}" deleted.` });
    } else {
      console.log(`[Server] /delete - Deleting file: ${itemPath}`);
      const blobClient = client.getBlobClient(itemPath);
      const response = await blobClient.deleteIfExists();
      if (response.succeeded) {
        console.log(`[Server] Response: /delete - File deleted. Path: "${itemPath}"`);
        res.status(200).json({ message: `File "${itemPath}" deleted.` });
      } else {
        console.log(`[Server] Response: /delete - File not found. Path: "${itemPath}"`);
        res.status(200).json({ message: `File "${itemPath}" not found.` }); // Treat as success
      }
    }
  } catch (error) {
    console.error(`[Server] Error: /delete - Path "${itemPath}":`, error);
    res.status(500).json({ message: 'Failed to delete item.', error: error.message, details: error.code });
  }
};

// --- NEW: Get Download URL ---
export const getDownloadUrl = async (req, res) => {
  const { path: blobPath } = req.query;
  console.log(`[Server] Request: /download-url - Path: "${blobPath}"`);

  if (!blobPath) {
    console.log('[Server] Error: /download-url - Path required.');
    return res.status(400).json({ message: 'Blob path is required.' });
  }

  try {
    const { client, credential } = ensureClientAndCredentials();
    const blobClient = client.getBlobClient(blobPath); // Get client for the specific blob

    // Check if blob exists (optional but good practice)
    const exists = await blobClient.exists();
    if (!exists) {
        console.log(`[Server] Error: /download-url - Blob not found: "${blobPath}"`);
        return res.status(404).json({ message: 'File not found.' });
    }

    const sasOptions = {
      containerName: containerName, // Use container name from config
      blobName: blobPath,
      startsOn: new Date(), // Start now
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000), // Expires in 1 hour
      permissions: BlobSASPermissions.parse("r"), // Read permissions
    };

    const sasToken = generateBlobSASQueryParameters(sasOptions, credential).toString();
    const sasUrl = `${blobClient.url}?${sasToken}`;

    console.log(`[Server] Response: /download-url - SAS URL generated for "${blobPath}"`);
    res.status(200).json({ url: sasUrl });

  } catch (error) {
    console.error(`[Server] Error: /download-url - Path "${blobPath}":`, error);
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
  console.log(`[Server] Request: /move - Source: "${sourcePath}", Destination Folder: "${destinationFolderPath}"`);

  if (!sourcePath || typeof destinationFolderPath === 'undefined') { // Allow empty string for root destination
    console.log('[Server] Error: /move - Source path and destination folder path are required.');
    return res.status(400).json({ message: 'Source path and destination folder path are required.' });
  }

  try {
    const client = ensureClient();
    const sourceBlobClient = client.getBlobClient(sourcePath);
    const sourceExists = await sourceBlobClient.exists();

    if (!sourceExists) {
      console.log(`[Server] Error: /move - Source path not found: "${sourcePath}"`);
      return res.status(404).json({ message: 'Source item not found.' });
    }

    // Determine if source is a directory by checking for blobs underneath or if it's a placeholder
    let isDirectory = false;
    const sourceProperties = await sourceBlobClient.getProperties();
    if (sourceProperties.metadata?.isDirectoryPlaceholder === "true") {
        isDirectory = true;
    } else {
        // Check if there are items under this prefix
        const iter = client.listBlobsByHierarchy('/', { prefix: `${sourcePath}/` });
        if (!(await iter.next()).done) {
            isDirectory = true;
        }
    }

    const sourceName = path.basename(sourcePath);
    const destinationPathBase = destinationFolderPath ? `${destinationFolderPath}/${sourceName}` : sourceName;

    if (isDirectory) {
      // --- Move Directory ---
      console.log(`[Server] /move - Moving directory: "${sourcePath}" to "${destinationFolderPath}"`);
      const sourcePrefix = sourcePath.endsWith('/') ? sourcePath : `${sourcePath}/`;
      const destinationPrefix = destinationPathBase.endsWith('/') ? destinationPathBase : `${destinationPathBase}/`;

      // Ensure destination doesn't already exist as a conflicting item (optional check)

      const blobs = client.listBlobsFlat({ prefix: sourcePrefix });
      let copyCount = 0;
      let deleteCount = 0;

      for await (const blob of blobs) {
        const relativePath = blob.name.substring(sourcePrefix.length);
        const destinationBlobPath = `${destinationPrefix}${relativePath}`;
        const sourceBlob = client.getBlobClient(blob.name);
        const destinationBlob = client.getBlobClient(destinationBlobPath);

        console.log(`[Server] /move - Copying ${blob.name} to ${destinationBlobPath}`);
        const copyPoller = await destinationBlob.beginCopyFromURL(sourceBlob.url);
        await copyPoller.pollUntilDone();
        copyCount++;
      }

      // After successful copy, delete original blobs
      const blobsToDelete = client.listBlobsFlat({ prefix: sourcePrefix });
      for await (const blob of blobsToDelete) {
        console.log(`[Server] /move - Deleting original ${blob.name}`);
        await client.deleteBlob(blob.name);
        deleteCount++;
      }
       // Attempt to delete the source directory placeholder if it exists
       try {
           const sourceDirPlaceholder = client.getBlockBlobClient(sourcePrefix);
           if (await sourceDirPlaceholder.exists()) {
               await sourceDirPlaceholder.delete();
               console.log(`[Server] /move - Deleted source directory placeholder ${sourcePrefix}`);
           }
       } catch(e) { /* Ignore if placeholder delete fails */ }

      console.log(`[Server] Response: /move - Directory moved. Copied ${copyCount}, Deleted ${deleteCount}.`);
      res.status(200).json({ message: `Directory "${sourceName}" moved successfully.` });

    } else {
      // --- Move File ---
      const destinationBlobPath = destinationPathBase;
      console.log(`[Server] /move - Moving file: "${sourcePath}" to "${destinationBlobPath}"`);
      const destinationBlobClient = client.getBlobClient(destinationBlobPath);

      // Check if destination file already exists (optional: decide whether to overwrite or fail)
      // const destExists = await destinationBlobClient.exists();
      // if (destExists) { return res.status(409).json({ message: 'Destination file already exists.' }); }

      console.log(`[Server] /move - Copying ${sourcePath} to ${destinationBlobPath}`);
      const copyPoller = await destinationBlobClient.beginCopyFromURL(sourceBlobClient.url);
      await copyPoller.pollUntilDone();

      console.log(`[Server] /move - Deleting original ${sourcePath}`);
      await sourceBlobClient.delete();

      console.log(`[Server] Response: /move - File moved.`);
      res.status(200).json({ message: `File "${sourceName}" moved successfully.` });
    }

  } catch (error) {
    console.error(`[Server] Error: /move - Source "${sourcePath}", Dest "${destinationFolderPath}":`, error);
    res.status(500).json({ message: 'Failed to move item.', error: error.message, details: error.code });
  }
};

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
    const sourceExists = await sourceBlobClient.exists();

    // --- Add Logging ---
    console.log(`[Helper] Source "${sourcePath}" exists: ${sourceExists}`);
    // --- End Logging ---

    if (!sourceExists) {
        // ... (existing robustness check using prefix - this part is likely okay) ...
    }

    // Determine if source is a directory
    let isDirectory = false;
    // ... (existing directory check logic - this part is likely okay) ...

    // --- Stats ---
    let stats = { copied: 0, deleted: 0, errors: [] };

    // --- Destination Base Path Construction ---
    // If renaming, the base destination is the target folder + new name
    // Otherwise, it's the target folder + original name
    const destinationBasePath = path.join(destinationFolderPath, effectiveDestName);
    console.log(`[Helper] Destination Base Path: "${destinationBasePath}"`);
    // --- End Destination Base Path ---


    if (isDirectory) {
        // --- Create destination directory placeholder if needed ---
        const destDirPlaceholder = `${destinationBasePath}/`; // Ensure trailing slash
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
            const destinationBlobName = path.join(destinationBasePath, relativePath).replace(/\\/g, '/'); // Ensure forward slashes

            console.log(`[Helper] Copying ${blob.name} to ${destinationBlobName}`);
            const destBlobClient = sourceClient.getBlobClient(destinationBlobName);
            const sourceBlobUrl = `${sourceClient.url}/${encodeURIComponent(blob.name)}`; // Use full URL for source

            try {
                const poller = await destBlobClient.beginCopyFromURL(sourceBlobUrl);
                await poller.pollUntilDone();
                stats.copied++;

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

        // If deleting source, attempt to delete the original directory placeholder (if it existed)
        if (deleteSource && sourceExists) { // Only delete placeholder if it existed initially
             try {
                 console.log(`[Helper] Deleting original directory placeholder ${sourcePath}`);
                 await sourceBlobClient.delete(); // Delete the placeholder blob
                 // stats.deleted++; // Maybe don't count placeholder? Or adjust logic.
             } catch (deleteError) {
                 // Ignore if not found, might have been deleted already or never existed
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
            const poller = await destBlobClient.beginCopyFromURL(sourceBlobUrl);
            await poller.pollUntilDone();
            stats.copied++;

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

    return stats;
}


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
        const stats = await copyOrMoveItemRecursive(client, sourcePath, destinationFolderPath, false); // false = don't deleteSource
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
  console.log(`[Server] Request: /rename - From "${originalPath}" to "${newPath}"`);

  // --- Validation ---
  if (!originalPath || !newPath) {
    return res.status(400).json({ message: 'Original and new paths are required.' });
  }
  const originalDir = path.dirname(originalPath);
  const newDir = path.dirname(newPath);
  const newName = path.basename(newPath); // Get just the new name

  if (originalDir !== newDir) {
    return res.status(400).json({ message: 'Rename must occur within the same directory.' });
  }
  if (!newName || newName.includes('/') || newName.startsWith('.') || newName.endsWith('.')) {
     return res.status(400).json({ message: `Invalid new name provided: "${newName}". Name cannot contain '/', start or end with '.'` });
  }
  // --- End Validation ---

  try {
    const client = ensureClient();
    const destinationClient = client.getBlobClient(newPath); // Check full new path for conflict
    const destExists = await destinationClient.exists();
    if (destExists) {
        return res.status(409).json({ message: `An item named "${newName}" already exists in this directory.` });
    }

    // --- Call recursive helper with newName ---
    // Pass originalPath, originalDir, deleteSource=true, and the newName
    const stats = await copyOrMoveItemRecursive(client, originalPath, originalDir, true, newName);
    // --- End Call ---

    // Check stats for errors
    if (stats.errors && stats.errors.length > 0) {
        console.error(`[Server] Response: /rename - Completed with errors:`, stats.errors);
        // Send a 207 Multi-Status or 500 Internal Server Error depending on severity
        return res.status(207).json({
            message: `Rename partially completed with ${stats.errors.length} error(s).`,
            errors: stats.errors,
            copied: stats.copied,
            deleted: stats.deleted
        });
    }

    if (stats.deleted > 0 || stats.copied > 0) { // Check copied as well for file rename
        console.log(`[Server] Response: /rename - Success. Copied ${stats.copied}, Deleted ${stats.deleted}.`);
        res.status(200).json({ message: `Successfully renamed "${path.basename(originalPath)}".` });
    } else {
        // This case might happen if the source didn't exist or helper failed before delete
        throw new Error('Rename failed: Source item could not be processed or deleted.');
    }

  } catch (error) {
    console.error(`[Server] Error: /rename - From "${originalPath}" to "${newPath}":`, error);
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

// --- End of Controller ---
