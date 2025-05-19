import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Calculate __dirname for ES modules early to find the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Construct the path to .env.local in the project root (two levels up from server/src)
const envPath = path.resolve(__dirname, '../../.env.local');

// Load environment variables FIRST, specifying the path
dotenv.config({ path: envPath }); 

// Debug environment variables 
console.log('[Server Start] AZURE_STORAGE_CONNECTION_STRING loaded:', !!process.env.AZURE_STORAGE_CONNECTION_STRING);
console.log('[Server Start] AZURE_STORAGE_CONTAINER_NAME:', process.env.AZURE_STORAGE_CONTAINER_NAME);

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

// Import document analysis routes
import documentAnalysisRoutes from './routes/documentAnalysisRoutes.js';
import pineconeRoutes from './routes/pineconeRoutes.js';

// Initialize Express app early for error handling
const app = express();
const PORT = process.env.PORT || 5000;

// Set up basic middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4000'], 
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Update the static path to use client/build instead of build/client
const staticPath = path.resolve(__dirname, '../../client/build'); 
console.log(`[Server Start] Looking for static files at: ${staticPath}`);

// Check if the static directory exists before serving
import fs from 'fs';
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  console.log(`[Server Start] Serving static files from: ${staticPath}`);
} else {
  console.warn(`[Server Start] Static path does not exist: ${staticPath}`);
  // Try an alternative path
  const altStaticPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(altStaticPath)) {
    app.use(express.static(altStaticPath));
    console.log(`[Server Start] Serving static files from alternate path: ${altStaticPath}`);
  } else {
    console.warn(`[Server Start] Alternate static path does not exist: ${altStaticPath}`);
  }
}

// Import routes with proper error handling
let routesLoaded = {
  clerk: false,
  upload: false,
  blob: false,
  pinecone: false,
  metadata: false
};

// Import routes AFTER dotenv.config() with try/catch blocks for better error handling
try {
  const clerkWebhookRoutes = (await import('./routes/clerkWebhookRoutes.js')).default;
  app.use('/api/webhooks', clerkWebhookRoutes);
  routesLoaded.clerk = true;
  console.log('[Server Start] Loaded clerk webhook routes');
} catch (error) {
  console.error('[Server Start] Failed to load clerk webhook routes:', error.message);
}

// Similarly fix upload routes loading
try {
  const uploadModule = await import('./routes/uploadRoutes.js');
  
  // Check what export format is available
  if (uploadModule.default) {
    app.use('/api', uploadModule.default);
    routesLoaded.upload = true;
    console.log('[Server Start] Loaded upload routes via default export');
  } else if (uploadModule.router) {
    app.use('/api', uploadModule.router);
    routesLoaded.upload = true;
    console.log('[Server Start] Loaded upload routes via named export');
  } else {
    const exportKeys = Object.keys(uploadModule);
    console.error('[Server Start] Upload routes module found but no usable export. Available exports:', exportKeys);
  }
} catch (error) {
  console.error('[Server Start] Failed to load upload routes:', error.message);
  console.error('[Server Start] Upload routes error stack:', error.stack);
}

// In the section where blob routes are loaded, update to ensure proper error handling
try {
  // Import blobRoutes directly with consistent naming
  const blobRoutes = await import('./routes/blobRoutes.js');
  
  // Check what export format is available and use it
  if (blobRoutes.router) {
    app.use('/api/blob', blobRoutes.router);
    routesLoaded.blob = true;
    console.log('[Server Start] Loaded blob routes via named export (router)');
  } else if (blobRoutes.default) {
    app.use('/api/blob', blobRoutes.default);
    routesLoaded.blob = true;
    console.log('[Server Start] Loaded blob routes via default export');
  } else {
    // Create detailed error for debugging
    const exportKeys = Object.keys(blobRoutes);
    console.error('[Server Start] Blob routes module found but no usable export. Available exports:', exportKeys);
    throw new Error(`Could not find usable export in blobRoutes.js. Available: ${exportKeys.join(', ')}`);
  }
} catch (error) {
  console.error('[Server Start] Failed to load blob routes:', error.message);
  // Log stack trace for deeper debugging
  console.error('[Server Start] Blob routes error stack:', error.stack);
}

try {
  // Try both export patterns for pinecone routes
  const pineconeModule = await import('./routes/pineconeRoutes.js');
  if (pineconeModule.router) {
    app.use('/api/pinecone', pineconeModule.router);
    routesLoaded.pinecone = true;
    console.log('[Server Start] Loaded pinecone routes via named export');
  } else if (pineconeModule.default) {
    app.use('/api/pinecone', pineconeModule.default);
    routesLoaded.pinecone = true;
    console.log('[Server Start] Loaded pinecone routes via default export');
  } else {
    console.error('[Server Start] Pinecone routes module found but neither default nor named export available');
  }
} catch (error) {
  console.error('[Server Start] Failed to load pinecone routes:', error.message);
}

// Try both metadata.js and metadataRoutes.js
try {
  // First try metadata.js (which seems to be the one with content)
  const metadataModule = await import('./routes/metadata.js');
  if (metadataModule.router) {
    app.use('/api/metadata', metadataModule.router);
    routesLoaded.metadata = true;
    console.log('[Server Start] Loaded metadata routes from metadata.js');
  } else {
    throw new Error('No router export found in metadata.js');
  }
} catch (error) {
  console.log('[Server Start] Failed to load metadata.js, trying metadataRoutes.js:', error.message);
  try {
    // Fall back to metadataRoutes.js
    const metadataRoutesModule = await import('./routes/metadataRoutes.js');
    if (metadataRoutesModule.default) {
      app.use('/api/metadata', metadataRoutesModule.default);
      routesLoaded.metadata = true;
      console.log('[Server Start] Loaded metadata routes from metadataRoutes.js');
    } else if (metadataRoutesModule.router) {
      app.use('/api/metadata', metadataRoutesModule.router);
      routesLoaded.metadata = true;
      console.log('[Server Start] Loaded metadata routes from metadataRoutes.js via named export');
    } else {
      console.error('[Server Start] Metadata routes module found but no usable export');
    }
  } catch (secondError) {
    console.error('[Server Start] Failed to load metadata routes from either file:', secondError.message);
  }
}

// Add document analysis routes
app.use('/api/document-analysis', documentAnalysisRoutes);

// Add diagnostics endpoint to check server status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    routes: routesLoaded,
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasAzureStorage: !!process.env.AZURE_STORAGE_CONNECTION_STRING,
      hasContainer: !!process.env.AZURE_STORAGE_CONTAINER_NAME
    }
  });
});

// Update the catch-all route to check if the file exists before sending
app.get('*', (req, res) => {
  // Only serve API at /api/* endpoints
  if (req.originalUrl.startsWith('/api/')) {
    console.log(`[API 404] API endpoint not found: ${req.originalUrl}`);
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  // For client-side routes, try to send index.html
  console.log(`[Catch-All] URL not served by static or API routes: ${req.originalUrl}`);
  
  // Try different possible index.html locations
  const possiblePaths = [
    path.resolve(__dirname, '../../client/build/index.html'),
    path.resolve(__dirname, '../../client/dist/index.html'),
    path.resolve(__dirname, '../../build/client/index.html'),
    path.resolve(__dirname, '../../client/public/index.html')
  ];
  
  for (const indexPath of possiblePaths) {
    if (fs.existsSync(indexPath)) {
      console.log(`[Catch-All] Sending index.html from: ${indexPath}`);
      return res.sendFile(indexPath);
    }
  }
  
  // If no index.html is found
  console.warn('[Catch-All] Could not find any index.html file');
  res.status(404).send('Application is running in API-only mode. Frontend files not found.');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ 
    error: 'Something went wrong on the server!',
    message: err.message,
    path: req.path
  });
});

// Start server with proper error handling
try {
  app.listen(PORT, () => {
    console.log(`[Server Start] Server running on port ${PORT}`);
    console.log('[Server Start] Available routes:');
    for (const [key, loaded] of Object.entries(routesLoaded)) {
      console.log(`- ${key}: ${loaded ? 'LOADED' : 'FAILED'}`);
    }
  });
} catch (error) {
  console.error('[Server Start] Critical error starting server:', error);
  process.exit(1);
}

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok',
    message: 'API server is running',
    timestamp: new Date().toISOString()
  });
});

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Create a blob route for testing
app.get('/api/blob/list', (req, res) => {
  console.log('Received request to list blobs with path:', req.query.path);
  res.json({ files: [] }); // Return empty list for now
});

export default app;
