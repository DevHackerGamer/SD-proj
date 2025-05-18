import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Fixed path to the metadata options file - corrected for your project structure
const metadataOptionsPath = path.resolve(__dirname, '../../../client/src/components/managefields/metadataOptions.json');

// Debug log to ensure path is correct
console.log('Metadata file path:', metadataOptionsPath);

// Add headers to prevent browser caching and reloads
router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });
  next();
});

// GET endpoint to retrieve metadata options
router.get('/options', (req, res) => {
  try {
    if (fs.existsSync(metadataOptionsPath)) {
      try {
        // Add content type and no-caching headers
        res.set('Content-Type', 'application/json');
        
        const data = fs.readFileSync(metadataOptionsPath, 'utf8');
        const parsedData = JSON.parse(data);
        res.json(parsedData);
      } catch (parseError) {
        console.error(`Invalid JSON in metadata options file:`, parseError);
        res.status(500).json({ 
          error: 'Failed to parse metadata options file', 
          details: parseError.message
        });
      }
    } else {
      console.error(`File not found at path: ${metadataOptionsPath}`);
      res.status(404).json({ error: 'Metadata options not found' });
    }
  } catch (error) {
    console.error('Error reading metadata options:', error);
    res.status(500).json({ 
      error: 'Failed to read metadata options',
      details: error.message
    });
  }
});

// POST endpoint to save metadata options
router.post('/options', (req, res) => {
  try {
    // Validate the incoming JSON
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid metadata format. Expected JSON object.' });
    }
    
    // Create directory if it doesn't exist
    const dir = path.dirname(metadataOptionsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // REMOVED BACKUP CREATION CODE
    // No longer creating backups that cause reloads
    
    // Format the JSON with consistent spacing
    const formattedJson = JSON.stringify(req.body, null, 2);
    
    // First validate if it's parseable
    try {
      JSON.parse(formattedJson);
    } catch (parseError) {
      return res.status(400).json({ 
        error: 'Invalid JSON data provided', 
        details: parseError.message 
      });
    }
    
    // Write to file
    fs.writeFileSync(metadataOptionsPath, formattedJson, 'utf8');
    console.log(`Successfully saved metadata options to: ${metadataOptionsPath}`);
    
    // Modify response to prevent reloads
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    });
    
    // Include the updated data in the response to avoid another GET request
    res.json({ 
      success: true,
      data: req.body // Return the same data we just saved
    });
  } catch (error) {
    console.error('Error saving metadata options:', error);
    res.status(500).json({ error: 'Failed to save metadata options', details: error.message });
  }
});

export { router };
