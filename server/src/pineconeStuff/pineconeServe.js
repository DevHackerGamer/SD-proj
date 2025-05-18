import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import { extractFeatures } from './embed.js';
import path from 'path';
import generateSasTokenForDocument from './generateDocumentSas.js';
import { getAnswer } from '../qapipeline/qanswer.js';
import { all } from 'axios';
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

    // Gather all context texts and SAS URLs
    const matches = Array.isArray(queryResponse.matches) ? queryResponse.matches : [];
    const allTexts = matches.map(match => (match.metadata && match.metadata.text) || '').join('\n\n');
    const sasUrls = matches.map(match => {
        const metadata = match.metadata || {};
        return {
            documentId: metadata.filename,
            // We'll fill in sasUrl below
        };
    });


        // Generate SAS URLs for each document
    const sasUrlsWithLinks = await Promise.all(sasUrls.map(async (item) => {
        const sasUrl = await generateSasTokenForDocument(item.documentId);
        return {
            sasUrl
        };
    }));

        // Ask the question using the combined context
    const answer = await getAnswer(queryText, allTexts);

    // console.log("[Pinecone] Processed results:", results);

    console.log("[Pinecone] Query completed.");
  // Return the answer and all SAS URLs
    console.log("[Pinecone] Combined context-answer:", { allTexts, answer });

    console.log("[Pinecone] Combined context-sasUrls:", [ ...new Set(sasUrlsWithLinks.map(item => item.sasUrl)) ]);
    return [{
        answer,
        //only return unique sasUrls
        sasUrls: [...new Set(sasUrlsWithLinks.map(item => item.sasUrl))]
    }];
}




