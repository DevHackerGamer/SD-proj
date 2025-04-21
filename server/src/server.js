import dotenv from 'dotenv';
import path from 'path'; // Import path
import { fileURLToPath } from 'url'; // Import fileURLToPath

// Calculate __dirname for ES modules early to find the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Construct the path to .env.local in the project root (two levels up from server/src)
const envPath = path.resolve(__dirname, '../../.env.local');

// Load environment variables FIRST, specifying the path
dotenv.config({ path: envPath }); 

// Log to confirm if the variable is loaded *after* config
console.log('[Server Start] AZURE_STORAGE_CONNECTION_STRING loaded:', !!process.env.AZURE_STORAGE_CONNECTION_STRING);

import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

// Import routes AFTER dotenv.config()
import clerkWebhookRoutes from './routes/clerkWebhookRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js'; 
import blobRoutes from './routes/blobRoutes.js'; // Ensure this points to the correct file

const PORT = process.env.PORT || 5000;

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  // Add the port you are testing with (4000) to allowed origins
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4000'], 
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' })); // Increase JSON limit for larger file operations
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' })); // Increase URL encoded limit

// Serve static files from the React build
// Calculate path relative to this file's directory (__dirname)
// server/src -> server -> project root -> build/client
const staticPath = path.resolve(__dirname, '../../build/client'); 
app.use(express.static(staticPath));
console.log(`Serving static files from: ${staticPath}`);

// API Routes - fix the route paths to avoid using full URLs
app.use('/api/webhooks', clerkWebhookRoutes); // Changed from '/api/webhooks/clerk'
app.use('/api', uploadRoutes); // Use upload routes under /api prefix
app.use('/api/blob', blobRoutes); // Ensure this uses the correctly imported variable

// Catch-all route for React router
app.get('*', (req, res) => {
  // Log requests that fall through to the catch-all to see what's missing
  console.log(`[Catch-All] URL not served by static or API routes: ${req.originalUrl}`); 
  // Calculate index.html path relative to this file's directory (__dirname)
  const indexPath = path.resolve(__dirname, '../../build/client/index.html'); 
  console.log(`[Catch-All] Sending index.html from: ${indexPath}`);
  res.sendFile(indexPath);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).send('Something went wrong on the server!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
