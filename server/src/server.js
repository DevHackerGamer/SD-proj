import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
// Re-import fileURLToPath and dirname to calculate relative paths
import { fileURLToPath } from 'url';
import { dirname } from 'path'; 
import bodyParser from 'body-parser';

// Import routes - uncomment these after verifying the files exist
import clerkWebhookRoutes from './routes/clerkWebhookRoutes.js';
// import uploadRoutes from './routes/uploadRoutes.js';

// Load environment variables
dotenv.config();

// Calculate __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename); 

// No longer need hardcoded projectRoot
// const projectRoot = '/app'; 
const PORT = process.env.PORT || 5000;

// Initialize Express app
const app = express();

// Middleware
app.use(cors({
  // Add the port you are testing with (4000) to allowed origins
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:4000'], 
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the React build
// Calculate path relative to this file's directory (__dirname)
// server/src -> server -> project root -> build/client
const staticPath = path.resolve(__dirname, '../../build/client'); 
app.use(express.static(staticPath));
console.log(`Serving static files from: ${staticPath}`);

// API Routes - fix the route paths to avoid using full URLs
app.use('/api/webhooks', clerkWebhookRoutes); // Changed from '/api/webhooks/clerk'

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
