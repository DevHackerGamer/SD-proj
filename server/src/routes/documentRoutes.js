import { Router } from 'express';
import multer from 'multer';
import { analyzeDocument, extractPdfText } from '../controllers/documentAnalysisController.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Existing route
router.post('/analyze', upload.single('file'), analyzeDocument);

// New route for Azure Document Intelligence text extraction
router.post('/extract-text', upload.single('file'), extractPdfText);

export default router;
