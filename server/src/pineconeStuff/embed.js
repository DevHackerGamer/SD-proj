import { pipeline } from "@xenova/transformers";
import { normalize } from "path";
import fs from 'fs/promises';
import path from 'path';
import { PDFExtract } from 'pdf.js-extract';
import os from 'os';
import { generateEmbeddings } from '../azure/openai.js';

// Keep Xenova pipeline as a fallback
let extractor;

// Function to load the local model
async function loadLocalModel() {
  try {
    console.log("[Embed] Loading local embedding model...");
    return await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  } catch (error) {
    console.error("[Embed] Could not load local model:", error.message);
    return null;
  }
}

// Initialize local model in background
loadLocalModel().then(model => {
  extractor = model;
  console.log("[Embed] Local embedding model loaded successfully");
}).catch(err => {
  console.warn("[Embed] Failed to initialize local model:", err.message);
});

// 1) Utility to split text into overlapping chunks
export function splitText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    chunks.push(text.slice(start, end));
    start = end - overlap;      // step back by overlap
    if (start < 0) start = 0;
  }
  return chunks;
}

// Function to extract features from text
export async function extractFeatures(textVector) {
  try {
    // Try using Azure OpenAI embeddings first
    try {
      console.log("[Embed] Generating embeddings with Azure OpenAI");
      const embeddings = await generateEmbeddings(textVector);
      console.log("[Embed] Azure OpenAI embeddings generated successfully");
      return Array.from(embeddings[0]); // Return the first embedding
    } catch (azureError) {
      console.warn("[Embed] Azure OpenAI embedding failed, falling back to local model:", azureError.message);
      
      // Fallback to local model
      if (!extractor) {
        console.log("[Embed] Loading local model on demand...");
        extractor = await loadLocalModel();
        
        if (!extractor) {
          throw new Error("Both Azure OpenAI and local model failed");
        }
      }
      
      console.log("[Embed] Generating embeddings with local model");
      const features = await extractor(
        textVector, // assumes there may be multiple texts
        {pooling: 'mean', normalize: 'true'});

      console.log("[Embed] Local model embeddings generated successfully");
      return Array.from(features.data);    
    }
  } catch (error) {
    console.error("[Embed] Error generating embeddings:", error.message);
    // Return a random embedding as a last resort to avoid crashing
    console.warn("[Embed] Generating random fallback embedding");
    return Array(384).fill(0).map(() => Math.random() * 2 - 1);
  }
}

// function to extract text from pdf

export async function extractTextFromPDF(pdfBuffer) {
    const pdfExtract = new PDFExtract();
    const options = {
        // Add any options you need here, e.g., disableCombineTextItems: true
    };

    // Use system temp directory instead of hardcoded C:\tmp
    const tempDir = path.join(os.tmpdir(), 'pdf-extracts');
    const tempFilePath = path.join(tempDir, `temp-${Date.now()}.pdf`);
    
    console.log(`[PDFExtract] Using temporary directory: ${tempDir}`);
    
    try {
        // Create the temporary directory if it doesn't exist
        try {
            await fs.mkdir(tempDir, { recursive: true });
            console.log(`[PDFExtract] Created temporary directory: ${tempDir}`);
        } catch (dirError) {
            console.warn(`[PDFExtract] Could not create temp directory: ${dirError.message}`);
        }
        
        // Write the buffer to the temporary file
        await fs.writeFile(tempFilePath, pdfBuffer);

        // Extract text from the temporary file
        const data = await pdfExtract.extract(tempFilePath, options);

        // Extract text from all pages
        let text = '';
        data.pages.forEach((page) => {
            text += page.content.map((item) => item.str).join(' ') + '\n';
        });

        console.log(`[PDFExtract] Extracted text length: ${text.length}`);
        return text.trim(); // Return the extracted text
    } catch (error) {
        console.error("[PDFExtract] Error extracting text from PDF:", error);
        // Return empty string on error instead of throwing
        return '';
    } finally {
        // Clean up the temporary file
        try {
            const fileExists = await fs.access(tempFilePath).then(() => true).catch(() => false);
            if (fileExists) {
                await fs.unlink(tempFilePath);
                console.log(`[PDFExtract] Deleted temporary file: ${tempFilePath}`);
            }
        } catch (cleanupError) {
            console.warn(`[PDFExtract] Failed to delete temporary file: ${tempFilePath} Error: ${cleanupError}`);
        }
    }
}

