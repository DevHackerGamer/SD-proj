import express from "express";
import multer from "multer";
import { BlobServiceClient } from "@azure/storage-blob";
import path from "path";
import dotenv from 'dotenv'; // Keep dotenv import if other routes might need it, but config is in server.js
import fs from 'fs'; // Import fs for file operations
// --- Remove updateMetadataJson import ---
// import { updateMetadataJson } from '../controllers/blobController.js'; // Assuming it's exported there, or keep helper here
// --- End Remove ---

const router = express.Router(); // Use express.Router

// Use multer memory storage to get file buffer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Helper function to safely parse JSON ---
const safeJsonParse = (str) => {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
};

// --- Remove updateMetadataJson helper function if it was defined here ---
// const updateMetadataJson = async (...) => { ... };
// --- End Remove ---


// --- NEW ROUTE: List files in the container ---
router.get("/files", async (req, res) => {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'files'; // Ensure this matches your container

  if (!connectionString) {
    console.error("[List Files] Azure Storage Connection String is missing.");
    return res.status(500).json({ error: "Server configuration error: Storage connection missing." });
  }

  try {
    console.log(`[List Files] Attempting to list blobs in container: ${containerName}`);
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const blobs = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      // Get necessary properties for each blob
      const blockBlobClient = containerClient.getBlockBlobClient(blob.name);
      blobs.push({
        name: blob.name,
        url: blockBlobClient.url, // Get the full URL
        lastModified: blob.properties.lastModified,
        contentType: blob.properties.contentType,
        size: blob.properties.contentLength,
      });
    }
    
    console.log(`[List Files] Found ${blobs.length} blobs.`);
    res.status(200).json(blobs);

  } catch (error) {
    console.error("[List Files] Error listing blobs:", error);
    if (error.statusCode === 403) {
         return res.status(500).json({ error: "Server error: Could not authenticate with storage service to list files." });
    }
     if (error.statusCode === 404) {
         return res.status(500).json({ error: `Server configuration error: Storage container '${containerName}' not found.` });
    }
    res.status(500).json({ error: "Failed to list files.", details: error.message });
  }
});
// --- END NEW ROUTE ---


// --- Modified Upload endpoint ---
// --- Pass req, res directly to the imported controller function ---
import { uploadFile as uploadFileController } from '../controllers/blobController.js'; // Import controller

// --- End Modified ---


export const upsertToPinecone = async (vectorId, text, metadata) => {
  try {
    console.log('Connecting to Pinecone index...');
    const index = pc.index('llama-text-embed-v2-index');
    console.log('Successfully connected to Pinecone index.');

    console.log('Upserting data to Pinecone...');
    const upsertResponse = await index.upsert({
      namespace: 'example-namespace',
      vectors: [
        {
          id: vectorId,
          values: text, // Ensure this is the embedding vector
          metadata: metadata,
        },
      ],
    });
    console.log('Upsert response:', upsertResponse);
    return upsertResponse;
  } catch (error) {
    console.error('Error upserting to Pinecone:', error);
    throw error;
  }
};


// --- NEW ROUTE: Upload and process PDF ---
router.post('/upload/pdf', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[PDF Upload] Received file: ${file.originalname}`);

    // Extract text from the PDF
    const pdfText = await extractTextFromPDF(file.path);
    console.log(`[PDF Upload] Extracted text from PDF: ${pdfText.slice(0, 100)}...`); // Log first 100 characters

    // Split text into chunks based on sentences
    const textChunks = pdfText.split(/(?<=[.!?])\s+/);
    console.log(`[PDF Upload] Split text into ${textChunks.length} chunks.`);

    // Upsert each chunk to Pinecone
    for (const chunk of textChunks) {
      const vectorId = `${file.filename}-${Date.now()}`; // Unique ID for each chunk
      const metadata = {
        fileLocation: `/uploads/${file.filename}`, // Adjust based on your storage setup
      };
      console.log(`[PDF Upload] Upserting chunk to Pinecone: ${chunk.slice(0, 50)}...`); // Log first 50 characters
      await upsertToPinecone(vectorId, chunk, metadata);
    }

    res.json({
      message: 'PDF uploaded and processed successfully',
      fileLocation: `/uploads/${file.filename}`,
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    res.status(500).json({ error: 'Failed to upload and process PDF' });
  }
});
// --- END NEW ROUTE ---

router.post("/upload", upload.single("file"), uploadFileController);



// --- Keep the export ---
export default router;
// --- End Keep ---