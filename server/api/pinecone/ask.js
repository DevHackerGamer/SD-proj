const { BlobServiceClient } = require('@azure/storage-blob');
const dotenv = require('dotenv');
const path = require('path');
const { extractFeatures } = require('../../src/pineconeStuff/embed.js');
const { generateChatCompletion } = require('../../src/azure/openai.js');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Initialize Azure Blob Storage client
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);
const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_CONTAINER_NAME
);

// Initialize Pinecone client - import from pineconeServe.js
const { queryPinecone } = require('../../src/pineconeStuff/pineconeServe.js');

/**
 * Handles user questions and provides AI-generated answers based on relevant documents
 */
module.exports = async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Valid question text is required' });
    }

    console.log(`[RAG] Processing question: "${question}"`);
    
    // Step 1: Query Pinecone for relevant documents
    const relevantDocs = await queryPinecone(question);
    
    if (!relevantDocs || relevantDocs.length === 0) {
      return res.status(404).json({ 
        answer: "I couldn't find any relevant information to answer your question. Please try rephrasing or asking something else.",
        sources: []
      });
    }
    
    console.log(`[RAG] Found ${relevantDocs.length} relevant documents`);
    
    // Step 2: Fetch full document content from Azure Blob Storage if needed
    // If the text from Pinecone is already sufficient, we can skip this step
    const enhancedDocs = relevantDocs;
    
    // Step 3: Format documents into a context string for the prompt
    const contextString = enhancedDocs.map((doc, index) => {
      return `Document ${index + 1}: ${doc.text}\nSource: ${doc.link || 'Unknown source'}`;
    }).join('\n\n');
    
    // Step 4: Create the prompt for Azure OpenAI
    const messages = [
      {
        role: "system",
        content: `You are a helpful assistant specializing in South African constitutional history and legal documents. 
        Answer the user's question based ONLY on the provided document contexts. 
        If the answer cannot be found in the documents, say "I don't have enough information to answer that question."
        Cite your sources by referring to the document numbers in your answer.`
      },
      {
        role: "user",
        content: `Question: ${question}\n\nContexts from relevant documents:\n${contextString}`
      }
    ];
    
    console.log(`[RAG] Sending prompt to Azure OpenAI`);
    
    // Step 5: Send the prompt to Azure OpenAI
    const completion = await generateChatCompletion(
      messages,
      {
        temperature: 0.3, // Lower temperature for more factual responses
        maxTokens: 500
      }
    );
    
    // Step 6: Process the response and send it back to the user
    const answer = completion.choices[0].message.content;
    
    // Format sources for citation
    const sources = enhancedDocs.map(doc => ({
      text: doc.text.substring(0, 150) + '...', // Preview of text
      link: doc.link || null,
    }));
    
    console.log(`[RAG] Sending response back to user`);
    
    res.status(200).json({
      answer,
      sources
    });
    
  } catch (error) {
    console.error('[RAG] Error processing question:', error);
    res.status(500).json({ 
      error: 'Failed to process your question',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
