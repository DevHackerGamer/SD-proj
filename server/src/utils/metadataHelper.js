import { BlobServiceClient } from '@azure/storage-blob';
import path from 'path';

// --- Access process.env directly ---
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
// --- End Access ---


if (!connectionString || !containerName) {
    // --- Add logging to see what *is* available (for debugging) ---
    console.error("❌ FATAL: Azure Storage connection string or container name is missing in environment variables.");
    console.error("Available process.env keys related to Azure:", Object.keys(process.env).filter(k => k.includes('AZURE')));
    console.error("Value for AZURE_STORAGE_CONNECTION_STRING:", process.env.AZURE_STORAGE_CONNECTION_STRING);
    console.error("Value for AZURE_STORAGE_CONTAINER_NAME:", process.env.AZURE_STORAGE_CONTAINER_NAME);
    // --- End logging ---
    throw new Error("Azure Storage configuration missing in environment variables.");
}

let serviceClient = null;
const ensureClient = () => {
    if (!serviceClient) {
        serviceClient = BlobServiceClient.fromConnectionString(connectionString);
    }
    return serviceClient.getContainerClient(containerName);
};


/**
 * Converts structured FileMetadata (likely received from the client)
 * into the Record<string, string> format suitable for Azure Blob Storage metadata.
 * Skips undefined/null/empty values.
 * Ensures keys are suitable for Azure (e.g., lowercase, no invalid chars - handled by Azure SDK).
 *
 * @param {object} metadata - The structured metadata object (like FileMetadata).
 * @returns {Record<string, string>} A Record<string, string> for Azure Blob metadata.
 */
// --- Add export keyword ---
export const formatMetadataForAzure = (metadata) => {
// --- End Add export ---
    const azureMetadata = {};

    // Helper function to add if value exists and is not empty
    const addIfPresent = (key, value) => {
        // ... existing code within the function ...
    };

    // ... existing code within the function ...

    console.log('[Metadata Helper] Formatted Metadata for Azure:', azureMetadata);
    return azureMetadata;
};


/**
 * Updates or creates a metadata.json file in the specified directory within the container.
 * This file aggregates metadata for all files within that directory.
 *
 * @param {string} directoryPath - The path to the directory (e.g., "folder/subfolder").
 * @param {string} updatedFileName - The name of the file whose metadata was just updated/added.
 * @param {object} updatedFileMetadata - The structured metadata for the updated file.
 */
// --- Ensure this function is also exported ---
export const updateMetadataJsonFile = async (directoryPath, updatedFileName, updatedFileMetadata) => {
// --- End Ensure export ---
    const metadataJsonPath = path.join(directoryPath, 'metadata.json').replace(/\\/g, '/');
    console.log(`[Metadata Helper] Attempting to update: ${metadataJsonPath}`);

    // ... rest of the function ...
};

/**
 * Generates a structured path based on metadata fields.
 * Used to determine where a file should be stored based on its metadata attributes.
 * Path format is customizable based on the application's requirements.
 * 
 * @param {object} metadata - The metadata object containing structured path information.
 * @returns {string} The calculated path (without filename).
 */
export const generatePathFromMetadata = (metadata) => {
    if (!metadata) return '';
    
    const pathParts = [];
    
    // Add appropriate path segments based on metadata fields
    // Customize this based on your application's path structure
    if (metadata.collection) {
        pathParts.push(metadata.collection);
    }
    
    // Handle jurisdiction if present
    if (metadata.jurisdiction?.type && metadata.jurisdiction?.name) {
        pathParts.push(`${metadata.jurisdiction.type}_${metadata.jurisdiction.name}`);
    } else if (metadata.jurisdiction?.name) {
        pathParts.push(metadata.jurisdiction.name);
    }
    
    // Handle thematic focus
    if (metadata.thematicFocus?.primary) {
        pathParts.push(metadata.thematicFocus.primary);
    }
    
    // Add other path components as needed for your application
    
    return pathParts.join('/');
};

/**
 * Checks if a directory is empty and deletes it if it is
 * 
 * @param {ContainerClient} containerClient - The Azure container client
 * @param {string} directoryPath - The path to check
 * @returns {Promise<boolean>} - True if directory was deleted, false otherwise
 */
export const checkAndDeleteEmptyDirectory = async (containerClient, directoryPath) => {
    if (!directoryPath) return false;
    
    // Ensure trailing slash for prefix search
    const prefix = directoryPath.endsWith('/') ? directoryPath : `${directoryPath}/`;
    console.log(`[Metadata Helper] Checking if directory "${directoryPath}" is empty`);
    
    try {
        // List blobs with this prefix
        const iterator = containerClient.listBlobsFlat({ prefix });
        
        // Get the first item
        const firstItem = await iterator.next();
        
        // If there are no items, the directory is empty
        const isEmpty = firstItem.done;
        
        if (isEmpty) {
            console.log(`[Metadata Helper] Directory "${directoryPath}" is empty, attempting to delete`);
            
            // Check for directory placeholder and delete it if exists
            const placeholderPath = prefix;
            const placeholderClient = containerClient.getBlockBlobClient(placeholderPath);
            
            // Also check for metadata.json
            const metadataJsonPath = path.join(directoryPath, 'metadata.json').replace(/\\/g, '/');
            const metadataJsonClient = containerClient.getBlockBlobClient(metadataJsonPath);
            
            // Try to delete both, ignore errors if they don't exist
            try {
                await placeholderClient.deleteIfExists();
                console.log(`[Metadata Helper] Deleted directory placeholder: ${placeholderPath}`);
            } catch (err) {
                console.warn(`[Metadata Helper] Error deleting directory placeholder at ${placeholderPath}:`, err.message);
            }
            
            try {
                await metadataJsonClient.deleteIfExists();
                console.log(`[Metadata Helper] Deleted metadata.json: ${metadataJsonPath}`);
            } catch (err) {
                console.warn(`[Metadata Helper] Error deleting metadata.json at ${metadataJsonPath}:`, err.message);
            }
            
            return true;
        } else {
            console.log(`[Metadata Helper] Directory "${directoryPath}" is not empty, skipping deletion`);
            return false;
        }
    } catch (error) {
        console.error(`[Metadata Helper] Error checking directory "${directoryPath}":`, error);
        return false;
    }
};

// --- Add export for ensureClient if needed elsewhere, otherwise keep it internal ---
// export { ensureClient };
// --- End Add export ---
