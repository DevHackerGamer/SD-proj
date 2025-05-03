import pdfExtract from 'pdf-extraction';
import {pipeline} from '@xenova/transformers';

const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );


// Extract text from a PDF file
export async function extractText(pdfPath) {
    try {
        const options = { splitPages: false }; // Configure the extraction options
        const extracted = await pdfExtract(pdfPath, options);
        return extracted.text;
    } catch (error) {
        console.error('Error reading PDF:', error);
        return null;
    }
}

// Function to clean the extracted text
export function cleanText(text) {
    // Remove unwanted characters or formatting
    return text.replace(/[^a-zA-Z0-9\s.,!?]/g, ' ').trim();
}

// Generate embeddings using an external embedding model (e.g., OpenAI)
export const generateEmbeddings = async (text) => {
  try {
    const response = await extractor(
        [text],
        { pooling: "mean", normalize: true }
      );
      return Array.from(response.data);
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
};