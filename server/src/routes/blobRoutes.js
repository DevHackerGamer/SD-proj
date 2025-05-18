import express from 'express';
import multer from 'multer';
import {
  testConnection,
  listFiles,
  uploadFile,
  deleteItem,
  getDownloadUrl,
  downloadFilesAsZip,
  moveItem,
  moveItems,
  copyItems,
  createDirectory,
  renameItem,
  getItemProperties,
  updateBlobMetadata,
  getMetadataJson,
  searchByMetadata
} from '../controllers/blobController.js';

const router = express.Router();

// Configure multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

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
router.get('/metadata', getMetadataJson); // Add route for getting metadata.json content
router.put('/update-metadata', updateBlobMetadata);
router.post('/search', searchByMetadata);

// Export the router
export { router };
export default router;
