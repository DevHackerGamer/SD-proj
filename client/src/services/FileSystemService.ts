import axios from 'axios';
import type { FileSystemItem, FileProperties } from '../components/BlobFileSystem/types'; // Adjust path if needed

const API_BASE_URL = '/api/blob'; // Or your configured base URL

// ... other service functions (listFiles, uploadFile, deleteItem, etc.) ...

/**
 * Moves multiple items (files or directories) to a new directory.
 * @param sourcePaths - An array of paths for the items to move.
 * @param destinationDirectory - The path of the target directory.
 */
export const moveItems = async (sourcePaths: string[], destinationDirectory: string): Promise<{ message: string; movedPaths?: string[]; itemsCopied?: number; itemsDeleted?: number; details?: any[] }> => {
    const endpoint = `${API_BASE_URL}/move-batch`;
    console.log(`[Service] Moving items: ${sourcePaths.length} items to "${destinationDirectory}"`);
    console.log('[Service] Payload:', { sourcePaths, destinationDirectory }); // Log the exact payload

    try {
        // --- Ensure POST request with correct body structure ---
        const response = await axios.post(endpoint, {
            sourcePaths: sourcePaths,             // Ensure key is 'sourcePaths' (array)
            destinationDirectory: destinationDirectory // Ensure key is 'destinationDirectory' (string)
        });
        // --- End Ensure ---

        console.log('[Service] Move successful:', response.data);
        return response.data; // Return the success response data
    } catch (error) {
        console.error(`[Service] Error moving items to "${destinationDirectory}":`, error);
        // Re-throw the error after logging or handle it via handleApiError
        throw handleApiError(error, 'move items');
    }
};


// ... other service functions (copyItems, renameItem, etc.) ...

// --- Error Handling Helper ---
const handleApiError = (error: any, operation: string): Error => {
    console.error(`[Service] Error during "${operation}":`, error);
    if (axios.isAxiosError(error)) {
        console.error(`[Service] Server Error Response Data for "${operation}":`, error.response?.data);
        console.error(`[Service] Original error object for "${operation}":`, error);
        const message = error.response?.data?.message || error.message || `Failed to ${operation}.`;
        const status = error.response?.status || 'Unknown';
        return new Error(`Server Error (${status}): ${message}`);
    } else {
        console.error(`[Service] Non-Axios error during "${operation}":`, error);
        return new Error(`An unexpected error occurred during ${operation}: ${error.message || 'Unknown error'}`);
    }
};

// Ensure this file exports all necessary functions
// export { listFiles, uploadFile, createDirectory, deleteItem, getDownloadUrl, downloadFilesAsZip, moveItem, moveItems, copyItems, renameItem, getItemProperties, handleApiError };

