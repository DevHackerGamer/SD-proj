import express from 'express';
import { getOptions, saveOptions } from '../controllers/metadataController.js';

const router = express.Router();

// Add debugging middleware
router.use((req, res, next) => {
  console.log(`[Metadata API] ${req.method} ${req.originalUrl}`);
  next();
});

// GET /api/metadata/options
router.get('/options', getOptions);

// POST /api/metadata/options
router.post('/options', saveOptions);

export default router;
