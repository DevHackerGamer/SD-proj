import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import { extractFeatures } from './embed.js';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });



console.log("[Pinecone] Initializing Pinecone client...");
const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});
const index = pc.index('archive-v1');

console.log("[Pinecone] Pinecone client initialized.");

// function to embed text and store it in Pinecone
export async function embedAndStore(text, fileName) {
  console.log("[Pinecone] Embedding and storing text in Pinecone...");

  // Extract features from the text
  const features = await extractFeatures(text);

  // Store the features in Pinecone
  const response = await index.upsert([
      {
        id: `${fileName}-${Date.now()}`, // unique ID for the vector
        values: features, // the feature vector
        metadata: {
            text: text,
            filename: fileName
        }, // metadata associated with the vector
      },
  ]);


  console.log("[Pinecone] Text embedded and stored in Pinecone.");
  return response;
}

export async function queryPinecone(queryText) {
    console.log("[Pinecone] Querying Pinecone...");
    
    // Extract features from the query text
    const features = await extractFeatures(queryText);
    
    // Query Pinecone for similar vectors
    const queryResponse = await index.query({
        vector: features,
        topK: 3, // number of similar vectors to return
        includeMetadata: true, // include metadata in the response
    });

    // console.log("[Pinecone] Query response:", queryResponse);

    // Process the response to extract text and file links
    const results = queryResponse.matches.map(match => {
        const metadata = match.metadata || {};
        return {
            text: metadata.text || 'No text available', // Extracted text from metadata
            link: metadata.filename, // Construct a link to the file
        };
    });

    // console.log("[Pinecone] Processed results:", results);

    console.log("[Pinecone] Query completed.");
    return results; // Return the processed results
}




