import { Router } from 'express';
import {
    testConnection,
    listFiles,
    uploadFile,
    createDirectory, // Ensure createDirectory is imported
    deleteItem,
    getDownloadUrl,
    downloadFilesAsZip,
    moveItem,
    moveItems,
    copyItems,
    renameItem, // Import renameItem
    getItemProperties, // Import getItemProperties
    getMetadataJson, // Import the new controller
    updateBlobMetadata // Import updateBlobMetadata
} from '../controllers/blobController.js';
import multer from 'multer';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

console.log('✅ Using Azure Blob Storage controller for real data.');

// Test endpoint
router.get('/test-connection', testConnection);

// Core File operations
router.get('/list', listFiles);
router.post('/upload', upload.single('file'), uploadFile);
router.post('/directory', createDirectory); // POST for creating
router.delete('/delete', deleteItem);
router.get('/download-url', getDownloadUrl);
router.post('/download-zip', downloadFilesAsZip);
router.post('/move', moveItem);
router.post('/move-batch', moveItems);
router.post('/copy-batch', copyItems);
router.post('/rename', renameItem); // Add POST route for renaming
router.get('/properties', getItemProperties); // Add GET route for properties

// --- NEW Route ---
router.get('/metadata', getMetadataJson); // Add route for getting metadata.json content
// --- END NEW ---

// --- NEW: Add Route for Updating Metadata ---
router.put('/update-metadata', updateBlobMetadata);
// --- END NEW ---

// Removed routes for non-existent functions:
// router.post('/upload-with-metadata', upload.single('file'), uploadWithMetadata);
// router.post('/ensure-directory', ensureDirectoryStructure);
// router.post('/create-metadata-file', createMetadataFile);
// router.get('/download-url', getDownloadUrl);
// router.get('/metadata', getMetadata);
// router.post('/metadata', updateMetadata);
// router.post('/rename', renameItem);
// router.post('/move', moveItems);
// router.post('/download-zip', downloadFilesAsZip);

export default router;
