import express from 'express';
import { queryPinecone, queryPineconeWithMetadata, extractMetadataFilters, explainEmbeddingProcess } from '../pineconeStuff/pineconeServe.js';
import { generateChatCompletion } from '../azure/openai.js';
import { getDocumentContent } from '../azure/blobStorage.js';
import { generateSasUrl } from '../azure/sasTokenGenerator.js';
import { documentExists } from '../azure/blobStorage.js';
import { generateSasTokenForDocument } from '../utils/generateDocumentSas.js';

const router = express.Router();

// Simple in-memory conversation store - in production use a proper database
const conversationStore = new Map();

// Function to determine if a query is a greeting/general conversation vs a specific document search
function isConversationalQuery(query) {
  const conversationalPatterns = [
    /^hello$/i, 
    /^hi$/i, 
    /^hey$/i,
    /^greetings$/i,
    /^how are you/i,
    /^what's up/i,
    /^good (morning|afternoon|evening)/i
  ];
  
  return conversationalPatterns.some(pattern => pattern.test(query.trim()));
}

// Function to check if a query is asking for documents/information specifically
function isDocumentSearchQuery(query) {
  const searchPatterns = [
    /find/i,
    /search/i,
    /documents/i,
    /legal/i,
    /constitution/i,
    /bill/i,
    /rights/i,
    /law/i,
    /court/i,
    /judgment/i,
    /case/i,
    /legislation/i,
    /metadata/i,
    /show me/i,
    /get/i,
    /retrieve/i,
    /locate/i
  ];
  
  return searchPatterns.some(pattern => pattern.test(query.trim()));
}

// Function to determine if a query is a follow-up question about previously retrieved documents
function isFollowUpQuery(query) {
  const followUpPatterns = [
    /tell me more/i,
    /explain/i,
    /elaborate/i,
    /what does (it|that|this) (say|mean)/i,
    /more information/i,
    /details/i,
    /when was/i,
    /who (wrote|authored|published)/i,
    /why is/i,
    /how does/i,
    /what is/i,
    /can you summarize/i,
    /in document \d/i,
    /about (this|that|these|those)/i,
    /related to/i
  ];
  
  return followUpPatterns.some(pattern => pattern.test(query.trim()));
}

// Create a route for the "ask" endpoint with conversation support
router.post('/ask', async (req, res) => {
  try {
    const { question, sessionId, conversationHistory = [] } = req.body;
    
    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({ error: 'Valid question text is required' });
    }

    console.log(`[RAG] Processing question: "${question}" (Session: ${sessionId || 'new'})`);
    
    // Initialize metadataFilters at the start to avoid undefined errors
    let metadataFilters = {};
    
    // Get or create conversation context
    let conversation = { history: [], documents: [] };
    if (sessionId && conversationStore.has(sessionId)) {
      conversation = conversationStore.get(sessionId);
      console.log(`[RAG] Retrieved existing conversation with ${conversation.history.length} messages and ${conversation.documents.length} documents`);
    } else {
      // Use client-provided history if available
      if (conversationHistory.length > 0) {
        conversation.history = conversationHistory;
      }
    }
    
    // Generate a new session ID if none provided
    const currentSessionId = sessionId || `session-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Check if this is a simple conversational query and no documents have been found yet
    if (isConversationalQuery(question) && !isDocumentSearchQuery(question) && conversation.documents.length === 0) {
      console.log(`[RAG] Detected conversational query, bypassing document search`);
      
      // For simple greetings, respond conversationally without searching for documents
      const conversationalMessages = [
        {
          role: "system",
          content: `You are a helpful assistant specializing in South African constitutional history and legal documents.
          Respond in a friendly, conversational way to general greetings.
          For specific questions about South African constitutional matters, encourage the user to ask about documents, 
          laws, or specific constitutional topics.`
        },
        {
          role: "user",
          content: question
        }
      ];
      
      try {
        const completion = await generateChatCompletion(
          conversationalMessages,
          {
            temperature: 0.7,
            max_tokens: 150
          }
        );
        
        return res.status(200).json({
          answer: completion.choices[0].message.content,
          sources: [],
          isConversational: true
        });
      } catch (error) {
        console.error('[RAG] Error generating conversational response:', error.message);
        return res.status(200).json({
          answer: "Hello! I'm your South African constitutional history assistant. How can I help you find documents or information today?",
          sources: [],
          isConversational: true
        });
      }
    }
    
    // Determine if this is a follow-up question about previously retrieved documents
    const isFollowUp = isFollowUpQuery(question) && conversation.documents.length > 0;
    
    // Special handling for direct topic queries - identify early but apply filters after initialization
    const { isDirectTopicQuery, topicName, exactFilters } = identifySpecificTopicQuery(question);
    
    if (isDirectTopicQuery) {
      console.log(`[RAG] Processing direct topic query for: ${topicName}`);
      // Assign exact filters to metadataFilters
      metadataFilters = exactFilters;
    } else {
      // Extract regular metadata filters for normal queries
      metadataFilters = extractMetadataFilters(question);
    }
    
    const hasMetadataFilters = Object.keys(metadataFilters).length > 0;
    console.log(`[RAG] Extracted metadata filters:`, metadataFilters);
    
    // Step 1: Query Pinecone for relevant documents using metadata-enhanced search
    let relevantDocs = [];
    
    try {
      // Use metadata-enhanced search for document queries or when filters are detected
      if (!isConversationalQuery(question) || isDocumentSearchQuery(question) || hasMetadataFilters) {
        console.log(`[RAG] Using metadata-enhanced search for: "${question}"`);
        
        // First try direct metadata match without vectorization to save tokens
        if (hasMetadataFilters) {
          console.log("[RAG] Performing direct metadata match first");
          // Try to get results using exact metadata matching first (more efficient)
          try {
            const metadataOnlyResults = await performDirectMetadataSearch(metadataFilters);
            
            if (metadataOnlyResults && metadataOnlyResults.length > 0) {
              console.log(`[RAG] Found ${metadataOnlyResults.length} results through direct metadata match`);
              relevantDocs = metadataOnlyResults;
            } else {
              // Fall back to vector similarity search with metadata filters
              console.log("[RAG] No direct metadata matches, using vector search with metadata filters");
              relevantDocs = await queryPineconeWithMetadata(question);
            }
          } catch (error) {
            console.error("[RAG] Error in direct metadata search:", error.message);
            // Fall back to standard search
            relevantDocs = await queryPineconeWithMetadata(question);
          }
        } else {
          // Standard vector search with potential metadata filtering
          relevantDocs = await queryPineconeWithMetadata(question);
        }
        
        // If no results found, try broader search
        if (relevantDocs.length === 0) {
          console.log(`[RAG] No results with strict filters, trying broader search`);
          // Try with relaxed metadata filters or no filters
          relevantDocs = await queryPinecone(question);
        }
      } else {
        // For conversational queries without metadata cues, use standard search
        relevantDocs = await queryPinecone(question);
      }
    } catch (pineconeError) {
      console.error('[RAG] Pinecone query error:', pineconeError.message);
      // Continue with empty docs instead of failing the entire request
    }
    
    // If no documents found and this isn't a follow-up, return appropriate response
    if ((!relevantDocs || relevantDocs.length === 0) && !isFollowUp) {
      return res.status(200).json({ 
        answer: "I couldn't find any relevant documents to answer your question. Please try being more specific about what type of constitutional or legal documents you're looking for.",
        sources: [],
        sessionId: currentSessionId
      });
    }
    
    // For follow-ups without docs (edge case), give a friendly error
    if ((!relevantDocs || relevantDocs.length === 0) && isFollowUp) {
      return res.status(200).json({ 
        answer: "I don't have any documents to reference for your follow-up question. Please try asking a new question to search for relevant documents first.",
        sources: [],
        sessionId: currentSessionId
      });
    }
    
    console.log(`[RAG] Working with ${relevantDocs.length} documents`);
    
    // Step 2: Ensure we have full document content from blob storage if needed
    const enhancedDocs = await Promise.all(relevantDocs.map(async (doc) => {
      // If we already have full text content, use that
      if (doc.text && doc.text.length > 200) {
        return doc;
      }
      
      // Otherwise try to fetch the complete document from blob storage
      try {
        if (doc.link) {
          console.log(`[RAG] Fetching full content for ${doc.link}`);
          const content = await getDocumentContent(doc.link);
          
          if (content) {
            console.log(`[RAG] Successfully enhanced document ${doc.link}`);
            
            // Try to parse JSON content for metadata-rich documents
            let metadata = doc.metadata || {};
            if (content.trim().startsWith('{') && content.includes('"files"')) {
              try {
                const jsonContent = JSON.parse(content);
                if (jsonContent.files) {
                  // Extract structured metadata from JSON files
                  metadata = {
                    ...metadata,
                    ...jsonContent,
                    extractedFromJson: true
                  };
                  console.log(`[RAG] Extracted rich metadata from JSON document`);
                }
              } catch (jsonError) {
                console.log(`[RAG] Document is not valid JSON: ${jsonError.message}`);
              }
            }
            
            return {
              ...doc,
              text: content,
              metadata,
              fullContentLoaded: true
            };
          }
        }
      } catch (error) {
        console.error(`[RAG] Error fetching document ${doc.link}:`, error.message);
      }
      
      // Return original document if enhancement failed
      return doc;
    }));
    
    console.log(`[RAG] Enhanced ${enhancedDocs.length} documents with full content`);
    
    // Add new documents to conversation context if not already present
    if (!isFollowUp) {
      conversation.documents = enhancedDocs;
    }
    
    // Identify if this is a request for a specific document
    const requestedDocIndex = identifyRequestedDocument(question, conversation.documents || []);
    const isSpecificDocRequest = requestedDocIndex !== -1;
    
    // Step 3: Format documents into a context string for the prompt
    const contextString = enhancedDocs.map((doc, index) => {
      // Limit the text length for very large documents
      const maxTextLength = isSpecificDocRequest && index === requestedDocIndex ? 2000 : 1000;
      
      // Safely handle different types of doc.text
      let docText;
      if (typeof doc.text === 'string') {
        docText = doc.text;
      } else if (typeof doc.text === 'object' && doc.text !== null) {
        try {
          docText = JSON.stringify(doc.text, null, 2);
        } catch (e) {
          docText = 'Complex document structure';
        }
      } else if (doc.text === null || doc.text === undefined) {
        docText = 'No content available';
      } else {
        docText = String(doc.text);
      }
      
      const shortenedText = docText.length > maxTextLength 
        ? docText.substring(0, maxTextLength) + "..." 
        : docText;
        
      return `Document ${index + 1}: ${shortenedText}\nSource: ${doc.link || 'Unknown source'}`;
    }).join('\n\n');
    
    // Build conversation context for the prompt
    const previousMessages = conversation.history.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');
    
    // Step 4: Create the prompt for Azure OpenAI with metadata awareness and follow-up handling
    const messages = [
      {
        role: "system",
        content: `You are a helpful assistant specializing in South African constitutional history and legal documents.
        Answer the user's question based on the provided document contexts and metadata.
        ${isFollowUp ? "This is a follow-up question about previously discussed documents." : ""}
        ${isSpecificDocRequest ? `The user is specifically asking about Document ${requestedDocIndex + 1}.` : ""}
        Pay special attention to document metadata like collection type, jurisdiction, thematic focus, and document function.
        Focus on explaining what documents are available and their relevance to the query.
        Highlight key metadata information about the documents, such as dates, authors, authorities, and document types.
        If asked to find documents, summarize what documents were found and their key attributes.
        If asked about document details, focus on explaining the content and purpose of the document.
        Refer to document metadata in your answers when relevant to enhance the context.
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
    let answer = "I couldn't process your question due to a technical issue. Please try again later.";
    try {
      const completion = await generateChatCompletion(
        messages,
        {
          temperature: 0.3, // Lower temperature for more factual responses
          max_tokens: 500   // Use snake_case (max_tokens) instead of camelCase (maxTokens)
        }
      );
      
      // Process the response
      answer = completion.choices[0].message.content;
    } catch (openaiError) {
      console.error('[RAG] Azure OpenAI error:', openaiError.message);
      // Return a partial response to the user instead of failing completely
      return res.status(200).json({ 
        answer: "I found some information, but I'm having trouble analyzing it right now. Here are the relevant sources I found:",
        sources: enhancedDocs.map(doc => ({
          text: doc.text.substring(0, 150) + '...', // Preview of text
          link: doc.link || null,
        })),
        error: "AI processing unavailable"
      });
    }
    
    // Filter sources to only include the most relevant ones
    console.log(`[RAG] Filtering sources to only show highly relevant documents`);
    const filteredDocs = isDirectTopicQuery
      ? relevantDocs // For direct topic queries, we've already done strict filtering
      : isSpecificDocRequest 
        ? enhancedDocs.filter((_, index) => index === requestedDocIndex)
        : limitToRelevantSources(enhancedDocs, question, metadataFilters);
    
    // Fix document links and generate SAS URLs
    const processedSources = await Promise.all(enhancedDocs.map(async (doc, index) => {
      let docID = doc.link;
      let sasUrl = null;
      
      // Skip if no link
      if (!docID) {
        return {
          // Safely handle doc.text that might not be a string
          text: getTextPreview(doc.text),
          link: null,
          sasUrl: null,
          documentNumber: index + 1
        };
      }
      
      // Fix the document path to remove localhost if present
      const fixedDocPath = fixDocumentPath(docID);
      console.log(`[RAG] Original doc path: ${docID}`);
      console.log(`[RAG] Fixed doc path: ${fixedDocPath}`);
      
      // Generate SAS URL for the document
      try {
        sasUrl = await generateSasTokenForDocument(fixedDocPath);
        
        if (!sasUrl) {
          console.log(`[RAG] Could not generate SAS URL for ${fixedDocPath}, trying original path`);
          sasUrl = await generateSasTokenForDocument(docID);
        }
      } catch (error) {
        console.error(`[RAG] Error generating SAS URL:`, error.message);
      }
      
      return {
        // Safely handle doc.text that might not be a string
        text: getTextPreview(doc.text),
        link: sasUrl,
        originalLink: sasUrl,
        sasUrl: sasUrl,
        documentNumber: index + 1
      };
    }));
    
    console.log(`[RAG] Sending response back to user`);
    
    // Add this interaction to conversation history
    conversation.history.push({ role: 'user', content: question });
    conversation.history.push({ role: 'assistant', content: answer });
    
    // Limit history length to avoid token limits (keep last 10 messages)
    if (conversation.history.length > 10) {
      conversation.history = conversation.history.slice(conversation.history.length - 10);
    }
    
    // Store the updated conversation
    conversationStore.set(currentSessionId, conversation);
    
    // Return response with session ID for continued conversation
    res.status(200).json({
      answer,
      sources: processedSources,
      metadata: {
        detectedFilters: metadataFilters,
        documentsFound: relevantDocs.length,
        specificDocumentRequested: isSpecificDocRequest ? requestedDocIndex + 1 : null
      },
      sessionId: currentSessionId,
      conversationHistory: conversation.history
    });
    
  } catch (error) {
    console.error('[RAG] Error processing question:', error);
    // Return a user-friendly error
    res.status(500).json({ 
      error: 'Failed to process your question. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Simple query endpoint for direct Pinecone queries
router.post('/query', async (req, res) => {
  try {
    const { queryText } = req.body;
    
    if (!queryText) {
      return res.status(400).json({ error: 'Query text is required' });
    }
    
    const results = await queryPinecone(queryText);
    res.json(results);
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    res.status(500).json({ error: 'Failed to query the database' });
  }
});

// Add a health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    pinecone: !!index ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Add route to get metadata information
router.get('/metadata-options', (req, res) => {
  try {
    // Send the metadata options from the JSON file
    const metadataInfo = explainEmbeddingProcess().metadataFields;
    res.status(200).json({
      metadataFields: metadataInfo,
      examples: explainEmbeddingProcess().examples
    });
  } catch (error) {
    console.error('Error getting metadata options:', error);
    res.status(500).json({ error: 'Failed to retrieve metadata options' });
  }
});

// Add a dedicated route for document SAS URL generation
router.get('/document-sas', async (req, res) => {
  try {
    const { path: docPath } = req.query;
    
    if (!docPath) {
      return res.status(400).json({ error: 'Document path is required' });
    }
    
    // Fix the document path
    const fixedPath = fixDocumentPath(docPath);
    console.log(`[API] Generating SAS URL for document path: ${fixedPath} (original: ${docPath})`);
    
    // Generate SAS URL
    const sasUrl = await generateSasUrl(fixedPath);
    
    if (!sasUrl) {
      return res.status(500).json({ 
        error: 'Failed to generate SAS URL',
        originalPath: docPath,
        fixedPath: fixedPath
      });
    }
    
    res.status(200).json({ 
      sasUrl,
      originalPath: docPath,
      fixedPath: fixedPath 
    });
  } catch (error) {
    console.error('[API] Error generating document SAS URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Fix document paths to ensure they're properly formatted for SAS generation
 * @param {string} docPath - Original document path
 * @returns {string} - Normalized document path
 */
function fixDocumentPath(docPath) {
  if (!docPath) return null;
  
  // Strip localhost or domain part if present
  if (docPath.includes('http://localhost') || docPath.includes('https://localhost')) {
    try {
      const url = new URL(docPath);
      // Return just the pathname without leading slash
      return url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
    } catch (error) {
      console.error(`[RAG] Failed to parse URL ${docPath}:`, error.message);
    }
  }
  
  // If the path doesn't need fixing, return as is
  return docPath;
}

/**
 * Filter sources to only include the most relevant ones
 * @param {Array} docs - The array of documents to filter
 * @param {string} query - The user's query
 * @param {Object} filters - Metadata filters extracted from the query
 * @returns {Array} - Filtered array of relevant documents
 */
function limitToRelevantSources(docs, query, filters) {
  if (!docs || !Array.isArray(docs) || docs.length === 0) {
    return [];
  }
  
  console.log(`[RAG] Filtering ${docs.length} sources for relevance`);
  
  // Check if we're filtering by a specific entity (like a political party)
  const targetEntity = filters['structuredPath.issuingAuthority.name'];
  const isEntitySearch = !!targetEntity;
  
  if (isEntitySearch) {
    console.log(`[RAG] Entity-specific search detected for: ${targetEntity}`);
  }
  
  // Score documents based on multiple relevance factors
  const scoredDocs = docs.map(doc => {
    let relevanceScore = doc.score || 0.5; // Base score from vector similarity
    
    // Factor 1: Specific entity match in metadata
    if (isEntitySearch) {
      // Check various paths where entity information might be stored in metadata
      let docAuthority = null;
      
      // Handle different metadata structures
      if (doc.metadata) {
        // Direct path
        docAuthority = doc.metadata?.structuredPath?.issuingAuthority?.name;
        
        // Check in files structure (common in JSON metadata)
        if (!docAuthority && doc.metadata.files) {
          const firstFileKey = Object.keys(doc.metadata.files)[0];
          if (firstFileKey) {
            docAuthority = doc.metadata.files[firstFileKey]?.structuredPath?.issuingAuthority?.name;
          }
        }
      }
      
      // Or try to extract from JSON text if it's a string
      if (!docAuthority && typeof doc.text === 'string' && doc.text.includes('"issuingAuthority"')) {
        try {
          // Try to parse JSON if it looks like a JSON string
          if (doc.text.trim().startsWith('{') && doc.text.includes('files')) {
            const jsonData = JSON.parse(doc.text);
            if (jsonData.files) {
              const firstFileKey = Object.keys(jsonData.files)[0];
              if (firstFileKey) {
                docAuthority = jsonData.files[firstFileKey]?.structuredPath?.issuingAuthority?.name;
              }
            }
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
      
      // Boost score for exact authority matches
      if (docAuthority === targetEntity) {
        relevanceScore += 0.4; // Major boost for exact match
        console.log(`[RAG] Boosting score for document from ${docAuthority}`);
      } else if (docAuthority && docAuthority !== targetEntity) {
        // Penalize documents from different authorities in entity searches
        relevanceScore -= 0.4;
        console.log(`[RAG] Reducing score for document from ${docAuthority} when ${targetEntity} was requested`);
      }
    }
    
    // Factor 2: Query terms in document
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 3);
    if (queryTerms.length > 0) {
      // Safely handle doc.text that might be an object rather than a string
      let docText = '';
      
      if (typeof doc.text === 'string') {
        // If it's already a string, use it directly
        docText = doc.text.toLowerCase();
      } else if (doc.text && typeof doc.text === 'object') {
        // If it's an object (like parsed JSON), stringify it for text search
        try {
          docText = JSON.stringify(doc.text).toLowerCase();
        } catch (e) {
          // Ignore stringify errors
        }
      }
      
      // If we have text to search, check for term matches
      if (docText) {
        const termMatches = queryTerms.filter(term => docText.includes(term)).length;
        const termMatchRatio = termMatches / queryTerms.length;
        
        // Boost for documents that contain query terms
        relevanceScore += termMatchRatio * 0.3;
      }
    }
    
    // Factor 3: Metadata completeness
    if (doc.metadata && Object.keys(doc.metadata).length > 5) {
      relevanceScore += 0.1; // Slight boost for well-described documents
    }
    
    return {
      ...doc,
      relevanceScore
    };
  });
  
  // Sort by relevance score
  const sortedDocs = scoredDocs.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // Determine how many documents to return based on search type
  const maxResults = isEntitySearch ? 2 : 3; // Stricter limit for entity searches
  const threshold = isEntitySearch ? 0.7 : 0.5; // Higher threshold for entity searches
  
  // Filter to only include documents above the relevance threshold
  const filteredDocs = sortedDocs.filter(doc => doc.relevanceScore >= threshold);
  
  // Limit to maximum number of results
  const limitedDocs = filteredDocs.slice(0, maxResults);
  
  console.log(`[RAG] Filtered to ${limitedDocs.length} most relevant documents from ${docs.length} total`);
  
  return limitedDocs;
}

/**
 * Extract key metadata fields for better context in prompts
 * @param {Object} metadata - Document metadata
 * @returns {Object} - Extracted key metadata fields
 */
function extractKeyMetadata(metadata) {
  if (!metadata) return {};
  
  const result = {};
  
  // Handle structured files format
  if (metadata.files) {
    // Get the first file's metadata as primary
    const firstFileKey = Object.keys(metadata.files)[0];
    if (firstFileKey && metadata.files[firstFileKey]) {
      const fileData = metadata.files[firstFileKey];
      
      // Extract structured path data
      if (fileData.structuredPath) {
        const sp = fileData.structuredPath;
        
        // Entity information (political party, etc.)
        if (sp.issuingAuthority) {
          if (sp.issuingAuthority.type) {
            result.authorityType = sp.issuingAuthority.type.replace(/_/g, ' ');
          }
          if (sp.issuingAuthority.name) {
            result.authorityName = sp.issuingAuthority.name.replace(/_/g, ' ');
          }
        }
        
        // Document characteristics
        if (sp.documentFunction) {
          result.documentType = sp.documentFunction.replace(/_/g, ' ');
        }
        
        // Thematic focus
        if (sp.thematicFocus) {
          if (sp.thematicFocus.primary) {
            result.thematicFocus = sp.thematicFocus.primary.replace(/_/g, ' ');
          }
          if (sp.thematicFocus.subthemes && sp.thematicFocus.subthemes.length > 0) {
            result.subthemes = sp.thematicFocus.subthemes.map(st => st.replace(/_/g, ' ')).join(', ');
          }
        }
        
        // Workflow info
        if (sp.workflowStage) {
          const stage = [];
          if (sp.workflowStage.primary) stage.push(sp.workflowStage.primary);
          if (sp.workflowStage.sub) stage.push(sp.workflowStage.sub);
          result.workflowStage = stage.join('_').replace(/_/g, ' ');
        }
        
        // Publication info
        if (fileData.publicationDate) {
          result.publicationDate = fileData.publicationDate;
        }
        
        // Language
        if (sp.language) {
          result.language = sp.language;
        }
      }
    }
  } else {
    // Handle flatter metadata structure
    if (metadata.structuredPath) {
      const sp = metadata.structuredPath;
      
      // Extract common fields
      if (sp.issuingAuthority && sp.issuingAuthority.name) {
        result.authorityName = sp.issuingAuthority.name.replace(/_/g, ' ');
      }
      
      if (sp.thematicFocus && sp.thematicFocus.primary) {
        result.thematicFocus = sp.thematicFocus.primary.replace(/_/g, ' ');
      }
    }
    
    // Direct metadata fields that might be present
    if (metadata.publicationDate) result.publicationDate = metadata.publicationDate;
    if (metadata.documentType) result.documentType = metadata.documentType;
    if (metadata.language) result.language = metadata.language;
  }
  
  return result;
}

/**
 * Check if a document is from a specific entity based on filters
 * @param {Object} doc - Document to check
 * @param {Object} filters - Metadata filters containing entity info
 * @returns {boolean} - True if document is from the entity in filters
 */
function isDocumentFromEntity(doc, filters) {
  if (!filters || !doc || !doc.metadata) return false;
  
  const targetEntity = filters['structuredPath.issuingAuthority.name'];
  if (!targetEntity) return false;
  
  // Check metadata paths where entity information might be stored
  const docEntity = 
    doc.metadata?.structuredPath?.issuingAuthority?.name ||
    doc.metadata?.issuingAuthority?.name ||
    (doc.metadata?.files && Object.values(doc.metadata.files).some(
      file => file?.structuredPath?.issuingAuthority?.name === targetEntity
    ));
  
  return docEntity === targetEntity;
}

/**
 * Check if a document matches the current query terms
 * @param {Object} doc - Document to check
 * @param {string} query - The current query
 * @returns {boolean} - True if document matches query
 */
function docMatchesQuery(doc, query) {
  if (!doc || !query) return false;
  
  const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 3);
  if (queryTerms.length === 0) return false;
  
  // Check if document text contains key query terms
  if (doc.text) {
    const docText = doc.text.toLowerCase();
    return queryTerms.some(term => docText.includes(term));
  }
  
  return false;
}

/**
 * Identify if user is asking about a specific document from previous conversation
 * @param {string} query - The user's question
 * @param {Array} docs - Documents from conversation context
 * @returns {number} - Index of requested document or -1 if not found
 */
function identifyRequestedDocument(query, docs) {
  if (!query || !docs || docs.length === 0) return -1;
  
  // Look for explicit document number references
  const docNumberMatch = query.match(/document\s+(\d+)/i);
  if (docNumberMatch && docNumberMatch[1]) {
    const requestedNumber = parseInt(docNumberMatch[1], 10);
    if (requestedNumber > 0 && requestedNumber <= docs.length) {
      return requestedNumber - 1; // Convert to zero-based index
    }
  }
  
  // Check if query is about a document that was explicitly mentioned before
  const explicitlyRequestedDocs = docs.filter(doc => doc.explicitlyRequested);
  if (explicitlyRequestedDocs.length === 1) {
    // If only one document was specifically requested before, assume follow-up is about it
    return docs.findIndex(doc => doc === explicitlyRequestedDocs[0]);
  }
  
  // Check query terms against document metadata
  const queryLower = query.toLowerCase();
  
  // Look for political party names or other distinctive entities
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    
    // Check if document is from a political party mentioned in the query
    const partyName = doc.metadata?.structuredPath?.issuingAuthority?.name || 
                      doc.metadata?.issuingAuthority?.name;
    
    if (partyName && queryLower.includes(partyName.toLowerCase())) {
      return i;
    }
    
    // Check if document has a distinctive theme mentioned in the query
    const theme = doc.metadata?.structuredPath?.thematicFocus?.primary;
    if (theme && queryLower.includes(theme.toLowerCase().replace(/_/g, ' '))) {
      return i;
    }
  }
  
  return -1;
}

/**
 * Analyze query for document content extraction parameters
 * @param {string} query - User's query
 * @param {number} docIndex - Index of the identified document
 * @param {Array} docs - Available documents
 * @param {Array} history - Conversation history
 * @returns {Object} - Document extraction parameters
 */
function analyzeContentExtractionRequest(query, docIndex, docs = [], history = []) {
  const queryLower = query.toLowerCase();
  let extractParams = {};
  
  // Check for extraction requests (last line, specific page, etc.)
  if (queryLower.includes('last line') || queryLower.includes('final line')) {
    extractParams.extractType = 'lastLine';
    console.log(`[RAG] User is asking for the last line of a document`);
  } else if (queryLower.includes('first line') || queryLower.includes('opening line')) {
    extractParams.extractType = 'firstLine';
    console.log(`[RAG] User is asking for the first line of a document`);
  } else if (queryLower.match(/page\s+(\d+)/i)) {
    const pageMatch = queryLower.match(/page\s+(\d+)/i);
    extractParams.extractType = 'page';
    extractParams.page = parseInt(pageMatch[1], 10);
    console.log(`[RAG] User is asking for page ${extractParams.page} of a document`);
  } else if (queryLower.match(/lines?\s+(\d+)(?:\s*-\s*|\s+to\s+)(\d+)/i)) {
    const lineMatch = queryLower.match(/lines?\s+(\d+)(?:\s*-\s*|\s+to\s+)(\d+)/i);
    extractParams.extractType = 'lineRange';
    extractParams.startLine = parseInt(lineMatch[1], 10);
    extractParams.endLine = parseInt(lineMatch[2], 10);
    console.log(`[RAG] User is asking for lines ${extractParams.startLine}-${extractParams.endLine}`);
  }
  
  return {
    docIndex: docIndex,
    extractParams: extractParams,
    isExtractionRequest: Object.keys(extractParams).length > 0
  };
}

/**
 * Check if query is targeting a specific collection or topic directly
 * @param {string} query - The user query
 * @returns {Object} Metadata filters and whether this is a direct topic query
 */
function identifySpecificTopicQuery(query) {
  // Get metadata options from the same place it's used in other functions
  // Assuming explainEmbeddingProcess() is a function that provides metadata options
  const metadataFieldsInfo = explainEmbeddingProcess().metadataFields;
  
  // Normalize the query
  const normalizedQuery = query.trim().toLowerCase();
  let isDirectTopicQuery = false;
  let topicName = null;
  let exactFilters = {};
  
  // Check if the query exactly matches a collection name
  const collections = metadataFieldsInfo.collections || [];
  for (const collection of collections) {
    // Check for exact match (with or without underscores)
    const normalizedCollection = collection.replace(/_/g, ' ').toLowerCase();
    if (normalizedQuery === collection.toLowerCase() || normalizedQuery === normalizedCollection) {
      exactFilters.collection = collection;
      isDirectTopicQuery = true;
      topicName = collection;
      console.log(`[RAG] Detected exact collection query for: ${collection}`);
      break;
    }
  }
  
  // Check for exact thematic focus match
  if (!isDirectTopicQuery) {
    const thematicFocus = metadataFieldsInfo.thematicFocus || [];
    for (const focus of thematicFocus) {
      const normalizedFocus = focus.replace(/_/g, ' ').toLowerCase();
      if (normalizedQuery === focus.toLowerCase() || normalizedQuery === normalizedFocus) {
        exactFilters['structuredPath.thematicFocus.primary'] = focus;
        isDirectTopicQuery = true;
        topicName = focus;
        console.log(`[RAG] Detected exact thematic focus query for: ${focus}`);
        break;
      }
    }
  }
  
  // Check for exact authority name match
  if (!isDirectTopicQuery) {
    const authorities = metadataFieldsInfo.authorities || [];
    for (const authority of authorities) {
      const normalizedAuthority = authority.replace(/_/g, ' ').toLowerCase();
      if (normalizedQuery === authority.toLowerCase() || normalizedQuery === normalizedAuthority) {
        exactFilters['structuredPath.issuingAuthority.name'] = authority;
        isDirectTopicQuery = true;
        topicName = authority;
        console.log(`[RAG] Detected exact authority query for: ${authority}`);
        break;
      }
    }
  }
  
  return {
    isDirectTopicQuery,
    topicName,
    exactFilters
  };
}

/**
 * Helper function to safely get a nested value from an object with support for wildcards
 * @param {Object} obj - The object to search
 * @param {string} path - The path with dot notation, can include * for wildcards
 * @returns {any} The value or undefined if not found
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Handle wildcard for array or object properties
    if (part === '*') {
      if (i === parts.length - 1) return current; // * at the end returns the parent
      
      // For wildcard, check all child properties
      const nextPart = parts[i + 1];
      const restPath = parts.slice(i + 2).join('.');
      
      // Array case
      if (Array.isArray(current)) {
        for (const item of current) {
          const result = item[nextPart];
          if (result !== undefined) {
            if (restPath) {
              const deepResult = getNestedValue(result, restPath);
              if (deepResult !== undefined) return deepResult;
            } else {
              return result;
            }
          }
        }
      } 
      // Object case
      else if (typeof current === 'object' && current !== null) {
        for (const key in current) {
          const child = current[key];
          if (child && child[nextPart] !== undefined) {
            if (restPath) {
              const deepResult = getNestedValue(child[nextPart], restPath);
              if (deepResult !== undefined) return deepResult;
            } else {
              return child[nextPart];
            }
          }
        }
      }
      
      return undefined;
    }
    
    // Regular property access
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  
  return current;
}

/**
 * Helper function to safely get a text preview regardless of input type
 * @param {any} text - The text content which might be a string, object, etc.
 * @param {number} maxLength - Maximum length of the preview
 * @returns {string} - A safe text preview
 */
function getTextPreview(text, maxLength = 150) {
  if (typeof text === 'string') {
    // If it's a string, use substring
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  } else if (typeof text === 'object' && text !== null) {
    // If it's an object (like parsed JSON), convert to string first
    try {
      const stringified = JSON.stringify(text);
      return stringified.length > maxLength ? stringified.substring(0, maxLength) + '...' : stringified;
    } catch (e) {
      return 'Complex document structure'; // Fallback for objects that can't be stringified
    }
  } else if (text === null || text === undefined) {
    return 'No content available';
  } else {
    // For any other type, convert to string
    return String(text).substring(0, maxLength) + (String(text).length > maxLength ? '...' : '');
  }
}

export default router;