import axios from 'axios';

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

/**
 * Analyze a document to extract description and tags
 * @param file The file to analyze
 * @returns Analysis results with description and keywords
 */
export const analyzeDocument = async (file: File): Promise<{
    success: boolean;
    description: string;
    keywords: string[];
    error?: string;
}> => {
    const endpoint = '/api/document-analysis/analyze';
    console.log(`[Service] Analyzing document: ${file.name}`);
    
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await axios.post(endpoint, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 30000, // Longer timeout for content analysis
        });
        
        console.log('[Service] Document analysis successful:', response.data);
        return response.data;
    } catch (error: any) {
        console.error(`[Service] Error analyzing document "${file.name}":`, error.message);
        
        // Extract error message from response if available
        const errorMessage = error.response?.data?.error || error.message || 'Failed to analyze document';
        
        return {
            success: false,
            description: '',
            keywords: [],
            error: errorMessage
        };
    }
};

// Add TypeScript declaration for PDF.js on the window object
declare global {
  interface Window {
    pdfjsLib: any; // You can replace 'any' with more specific types if you have PDF.js typings
  }
}

/**
 * Extracts text from a PDF file by converting to a temporary text file locally
 * @param file The PDF file to extract text from
 * @returns The extracted text content as a string
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
    console.log(`[Service] Starting PDF text extraction for: ${file.name} (size: ${file.size} bytes)`);

    try {
        // Replace the PDF.js implementation with Azure Document Intelligence
        let extractedText = '';
        try {
            console.log(`[Service] Using Azure Document Intelligence to extract text from PDF`);
            
            // Create FormData object to send the file to backend
            const formData = new FormData();
            formData.append('file', file);
            
            // Call your backend API that connects to Azure Document Intelligence
            const response = await axios.post('/api/azure-document-intelligence/extract-text', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000, // Longer timeout for Azure processing
            });
            
            // Log and process the response
            console.log(`[Service] Azure Document Intelligence extraction complete:`, {
                success: response.data.success,
                contentLength: response.data.text?.length || 0,
            });
            
            if (response.data.success && response.data.text) {
                extractedText = response.data.text;
                console.log(`[Service] Extracted ${extractedText.length} characters of text`);
                
                // Log a sample of the extracted text
                if (extractedText.length > 0) {
                    console.log(`[Service] Text sample (first 200 chars): "${extractedText.substring(0, 200)}..."`);
                }
            } else {
                console.warn(`[Service] Azure extraction succeeded but returned no text or failed:`, response.data);
                throw new Error(response.data.error || 'Azure Document Intelligence returned no text');
            }
        } catch (error) {
            console.error('[Service] Error using Azure Document Intelligence:', error);
            throw error;
        }
        
        // Step 2: Create a downloadable text file (not actually downloaded but created in memory)
        console.log(`[Service] Creating text file with ${extractedText.length} characters`);
        const textBlob = new Blob([extractedText], { type: 'text/plain' });
        const textFile = new File([textBlob], `${file.name.replace(/\.pdf$/i, '')}.txt`, { type: 'text/plain' });
        
        // Step 3: Read the content from the text file
        console.log(`[Service] Reading content from temporary text file`);
        const textContent = await textFile.text();
        
        // Step 4: "Delete" the temporary text file (in browser this happens automatically via garbage collection)
        console.log(`[Service] Temporary text file processed, content extracted`);
        
        // Check if the extracted text seems to be valid or shows signs of errors
        if (textContent.includes("This document appears to be") && 
            textContent.includes("It may be encrypted") && 
            textContent.includes("could not be properly extracted")) {
            
            console.warn("[Service] Extracted text contains error messages that falsely indicate encryption:");
            console.warn("[Service] Raw extracted content:", textContent);
            
            // Return a more helpful message
            return `[DEBUG INFO] PDF extraction thinks this is encrypted but it may be a false positive. See browser console for detailed extraction logs.`;
        }
        
        // Return the extracted text content
        return textContent;
    } catch (error) {
        console.error('[Service] Error extracting text from PDF:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `[Unable to extract text from this PDF: ${errorMessage}]`;
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
// export { listFiles, uploadFile, createDirectory, deleteItem, getDownloadUrl, downloadFilesAsZip, moveItem, moveItems, copyItems, renameItem, getItemProperties, handleApiError, analyzeDocument, extractTextFromPDF };

