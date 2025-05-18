import express from 'express';
import multer from 'multer';
import { analyzeDocument } from '../controllers/documentAnalysisController.js';

const router = express.Router();

// Configure multer for in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  }
});

// Route for document analysis
router.post('/analyze', upload.single('file'), analyzeDocument);

export default router;
