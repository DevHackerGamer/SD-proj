import fs from 'fs';
import path from 'path';

// Path to metadata options file 
const metadataFilePath = path.resolve(process.cwd(), 'client/src/components/managefields/metadataOptions.json');

// Ensure the directory exists
const metadataDir = path.dirname(metadataFilePath);
if (!fs.existsSync(metadataDir)) {
  console.log(`[MetadataController] Creating directory: ${metadataDir}`);
  fs.mkdirSync(metadataDir, { recursive: true });
}

// Create default file if it doesn't exist
if (!fs.existsSync(metadataFilePath)) {
  console.log(`[MetadataController] Creating default metadata file: ${metadataFilePath}`);
  const defaultOptions = {
    documentTypes: [],
    languages: [],
    countries: [],
    topics: [],
    collections: [],
    jurisdictions: {
      "types": [],
      "names": []
    }
  };
  fs.writeFileSync(metadataFilePath, JSON.stringify(defaultOptions, null, 2), 'utf8');
}

console.log(`[MetadataController] Metadata file path: ${metadataFilePath} (exists: ${fs.existsSync(metadataFilePath)})`);

/**
 * Get metadata options
 */
export const getOptions = async (req, res) => {
  console.log('[MetadataController] Request: GET /metadata/options');
  try {
    // Force refresh if requested via query param
    const refresh = req.query.refresh === 'true';
    
    // Check if file exists before trying to read it
    if (!fs.existsSync(metadataFilePath)) {
      console.warn(`[MetadataController] File not found: ${metadataFilePath}, creating empty one`);
      await fs.promises.writeFile(
        metadataFilePath, 
        JSON.stringify({}, null, 2),
        'utf8'
      );
    }
    
    const options = await fs.promises.readFile(metadataFilePath, 'utf8')
      .then(data => {
        try {
          return JSON.parse(data);
        } catch (parseError) {
          console.error(`[MetadataController] Invalid JSON in file: ${metadataFilePath}`, parseError);
          return {};
        }
      })
      .catch(err => {
        console.error('[MetadataController] Error reading metadata options:', err);
        return {};
      });
      
    console.log(`[MetadataController] Successfully retrieved metadata options with keys: ${Object.keys(options).join(', ')}`);
    res.status(200).json(options);
  } catch (error) {
    console.error('[MetadataController] Error getting metadata options:', error);
    res.status(500).json({ error: 'Failed to get metadata options', details: error.message });
  }
};

/**
 * Save metadata options
 */
export const saveOptions = async (req, res) => {
  console.log('[MetadataController] Request: POST /metadata/options');
  try {
    const options = req.body;
    const noBackup = req.query.noBackup === 'true';
    
    console.log(`[MetadataController] Save options with noBackup=${noBackup}`);
    
    if (!options || typeof options !== 'object') {
      return res.status(400).json({ error: 'Invalid metadata options format' });
    }
    
    // Create backup if requested (and if path exists)
    if (!noBackup && fs.existsSync(metadataFilePath)) {
      const backupPath = `${metadataFilePath}.backup`;
      try {
        fs.copyFileSync(metadataFilePath, backupPath);
        console.log(`[MetadataController] Created backup at ${backupPath}`);
      } catch (backupError) {
        console.warn(`[MetadataController] Failed to create backup: ${backupError.message}`);
        // Continue with save even if backup fails
      }
    }
    
    // Save the file
    await fs.promises.writeFile(
      metadataFilePath, 
      JSON.stringify(options, null, 2),
      'utf8'
    );
    
    console.log(`[MetadataController] Metadata options saved successfully`);
    res.status(200).json({ message: 'Metadata options saved successfully' });
  } catch (error) {
    console.error('[MetadataController] Error saving metadata options:', error);
    res.status(500).json({ error: 'Failed to save metadata options' });
  }
};
