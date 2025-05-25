import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import { extractFeatures } from './embed.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDocumentContent, listAllDocuments } from '../azure/blobStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

// Pinecone configuration from environment variables
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'archive-pro-rag';
const PINECONE_INDEX_HOST = process.env.PINECONE_INDEX_HOST

console.log("[Pinecone] Initializing Pinecone client...");
console.log(`[Pinecone] Index: ${PINECONE_INDEX_NAME}`);

// Initialize Pinecone client
let pc;
let index;
let pineconeInitialized = false;


try {
  pc = new Pinecone({
    apiKey: PINECONE_API_KEY,
  });
  
  index = pc.index(PINECONE_INDEX_NAME, PINECONE_INDEX_HOST);
  
  
  pineconeInitialized = true;
  console.log("[Pinecone] Pinecone client initialized");
} catch (error) {
  console.error("[Pinecone] Failed to initialize Pinecone client:", error.message);
}
const namespace = pc.index(PINECONE_INDEX_NAME, PINECONE_INDEX_HOST).namespace("Chunky")

// Mock in-memory storage as a fallback when Pinecone is unavailable
const memoryVectorStore = [];

// Load documents from Azure Blob Storage if vector store is empty
async function loadBlobStorageDocuments() {
  console.log("[Pinecone] Loading documents from Blob Storage");
  
  try {
    // Get list of documents from Blob Storage
    const documents = await listAllDocuments();
    
    if (documents.length === 0) {
      console.log("[Pinecone] No documents found in Blob Storage");
      return [];
    }
    
    console.log(`[Pinecone] Found ${documents.length} documents in Blob Storage`);
    
    // Process documents in batches to avoid overloading memory
    const batchSize = 5;
    const documentsWithContent = [];
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await Promise.all(batch.map(async (doc) => {
        // Skip non-text documents
        if (doc.properties.contentType && 
            !doc.properties.contentType.includes('text') && 
            !doc.properties.contentType.includes('json') &&
            !doc.properties.contentType.includes('xml')) {
          return;
        }
        
        try {
          const content = await getDocumentContent(doc.name);
          if (content) {
            documentsWithContent.push({
              id: doc.name,
              text: content,
              metadata: {
                ...doc.metadata,
                filename: doc.name,
                contentType: doc.properties.contentType,
                lastModified: doc.properties.lastModified
              }
            });
          }
        } catch (error) {
          console.error(`[Pinecone] Error loading document ${doc.name}:`, error.message);
        }
      }));
      
      console.log(`[Pinecone] Processed ${i + batch.length} of ${documents.length} documents`);
    }
    
    return documentsWithContent;
  } catch (error) {
    console.error("[Pinecone] Error loading documents from Blob Storage:", error.message);
    return [];
  }
}

// function to embed text and store it in Pinecone
export async function embedAndStore(text, fileName) {
  console.log("[Pinecone] Embedding and storing text...");

  try {
    // Extract features from the text
    const features = await extractFeatures(text);
    
    const vectorEntry = {
      id: `${fileName}#${Date.now()}`, // unique ID for the vector
      values: features, // the feature vector
      metadata: {
        text: text,
        filename: fileName
      }, // metadata associated with the vector
    };

    // Try to store in Pinecone first
    if (pineconeInitialized && index) {
      try {
        const response = await namespace.upsert([vectorEntry]);
        console.log("[Pinecone] Text embedded and stored in Pinecone.");
        return response;
      } catch (pineconeError) {
        console.error("[Pinecone] Failed to store in Pinecone, using memory fallback:", pineconeError.message);
        // Fall back to memory storage
        memoryVectorStore.push(vectorEntry);
        return { upsertedCount: 1 };
      }
    } else {
      // Pinecone not available, use memory storage
      console.log("[Pinecone] Pinecone not available, storing in memory");
      memoryVectorStore.push(vectorEntry);
      return { upsertedCount: 1 };
    }
  } catch (error) {
    console.error("[Pinecone] Error embedding and storing text:", error.message);
    throw error;
  }
}

export async function queryPinecone(queryText) {
  console.log("[Pinecone] Querying for similar documents...");
  
  try {
    // Extract features from the query text
    const features = await extractFeatures(queryText);
    
    // Try to query Pinecone first
    if (pineconeInitialized && index) {
      try {
        const queryResponse = await namespace.query({
          vector: features,
          topK: 2,
          includeMetadata: true,
        });
        
        // Process the response to extract text and file links
        const results = queryResponse.matches.map(match => {
          const metadata = match.metadata || {};
          return {
            id: match.id,
            text: metadata.text || 'No text available',
            link: metadata.filename,
            score: match.score,
          };
        });
        
        console.log(`[Pinecone] Query completed. Found ${results.length} results in Pinecone.`);
        return results;
      } catch (pineconeError) {
        console.error("[Pinecone] Error querying Pinecone, using fallbacks:", pineconeError.message);
        // Fall back to other methods
      }
    }
    
    // Check if we have any vectors in memory
    if (memoryVectorStore.length > 0) {
      console.log("[Pinecone] Using in-memory vector store for search");
      
      // Simple vector similarity calculation for the in-memory store
      const results = memoryVectorStore.map(entry => {
        const dotProduct = features.reduce((sum, val, i) => sum + val * entry.values[i], 0);
        return {
          id: entry.id,
          text: entry.metadata.text,
          link: entry.metadata.filename,
          score: dotProduct, // Simple similarity score
        };
      })
      .sort((a, b) => b.score - a.score) // Sort by similarity
      .slice(0, 5); // Take top 5
      
      console.log(`[Pinecone] Query completed. Found ${results.length} results in memory.`);
      return results;
    }
    
    // If no results yet, try getting documents from Blob Storage
    console.log("[Pinecone] No vectors in memory, loading from Blob Storage");
    const blobDocuments = await loadBlobStorageDocuments();
    
    if (blobDocuments.length === 0) {
      console.log("[Pinecone] No documents found in Blob Storage");
      return [];
    }
    
    console.log(`[Pinecone] Loaded ${blobDocuments.length} documents from Blob Storage`);
    
    // Create embeddings for the blob documents and add to memory store
    await Promise.all(blobDocuments.map(async (doc) => {
      try {
        const docFeatures = await extractFeatures(doc.text);
        memoryVectorStore.push({
          id: doc.id,
          values: docFeatures,
          metadata: {
            text: doc.text,
            filename: doc.id,
            ...doc.metadata
          }
        });
      } catch (error) {
        console.error(`[Pinecone] Error creating embedding for ${doc.id}:`, error.message);
      }
    }));
    
    console.log(`[Pinecone] Added ${memoryVectorStore.length} documents to memory store`);
    
    // Now query the in-memory store again
    if (memoryVectorStore.length > 0) {
      const results = memoryVectorStore.map(entry => {
        const dotProduct = features.reduce((sum, val, i) => sum + val * entry.values[i], 0);
        return {
          id: entry.id,
          text: entry.metadata.text,
          link: entry.metadata.filename,
          score: dotProduct,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
      
      console.log(`[Pinecone] Query completed. Found ${results.length} results from Blob Storage.`);
      return results;
    }
    
    return [];
  } catch (error) {
    console.error("[Pinecone] Error during query:", error.message);
    // Return empty results instead of failing
    return [];
  }
}

// Use existing imports and fs to read the JSON file
import fs from 'fs';
// Don't redeclare fileURLToPath since it's already imported at the top of the file
const metadataOptionsPath = path.resolve(__dirname, '../../../client/src/components/managefields/metadataOptions.json');
let metadataOptions = {};

try {
  const metadataOptionsContent = fs.readFileSync(metadataOptionsPath, 'utf8');
  metadataOptions = JSON.parse(metadataOptionsContent);
  console.log("[Pinecone] Successfully loaded metadata options");
} catch (error) {
  console.error("[Pinecone] Error loading metadata options:", error.message);
  // Provide default empty structure if the file can't be loaded
  metadataOptions = {
    collection: [],
    jurisdictionName: { National: [], Provincial: [], Traditional_Authorities: [] },
    thematicFocusPrimary: [],
    documentFunction: [],
    issuingAuthorityType: [],
    issuingAuthorityName: {}
  };
}

// Add this function to explain Pinecone embedding utilization
export function explainEmbeddingProcess() {
  return {
    process: [
      {
        step: "Text Embedding Generation",
        description: "When a document is uploaded or a query is made, the text is converted into a high-dimensional vector (embedding) using either Azure OpenAI or a local embedding model. This vector captures the semantic meaning of the text.",
        technicalDetails: "The embedding model transforms text into a 1536-dimensional vector where semantically similar texts have vectors closer to each other in the vector space."
      },
      {
        step: "Vector Storage",
        description: "Document embeddings are stored in Pinecone (or in memory if Pinecone is unavailable) along with metadata including the document content and source information.",
        technicalDetails: "Each vector in Pinecone has a unique ID, the vector values, and metadata like the text content and file references."
      },
      {
        step: "Metadata Extraction & Indexing",
        description: "Documents are indexed with structured metadata fields like collection, jurisdiction, thematic focus, and document function extracted from their source information.",
        technicalDetails: "Metadata fields follow a predefined schema with controlled vocabularies for each field, enabling precise filtering and categorization."
      },
      {
        step: "Metadata-Enhanced Query Processing",
        description: "User queries are analyzed to extract relevant metadata filters (e.g., 'human rights documents from KZN' identifies both thematic focus and jurisdiction).",
        technicalDetails: "Queries combine vector similarity search with metadata filters for more precise, context-aware results."
      },
      {
        step: "Similarity Search",
        description: "When a query is received, it is also converted to an embedding vector and compared against all stored vectors to find the most similar documents.",
        technicalDetails: "Pinecone uses approximate nearest neighbor search algorithms to efficiently find the most similar vectors without checking every vector in the database."
      },
      {
        step: "Result Ranking",
        description: "Documents are ranked by similarity score, with the most semantically similar documents appearing first in the results.",
        technicalDetails: "Similarity is calculated using cosine similarity or dot product between the query vector and document vectors."
      },
      {
        step: "Context Assembly",
        description: "The top matching documents are retrieved and their content is assembled into a context for the AI to generate a relevant response.",
        technicalDetails: "This forms the 'retrieval' part of RAG (Retrieval Augmented Generation), allowing the AI to answer based on specific, relevant document content."
      }
    ],
    metadataFields: {
      collections: metadataOptions.collection || [],
      jurisdictions: (metadataOptions.jurisdictionName?.National || []).concat(
        metadataOptions.jurisdictionName?.Provincial || [], 
        metadataOptions.jurisdictionName?.Traditional_Authorities || []
      ),
      thematicFocus: metadataOptions.thematicFocusPrimary || [],
      documentTypes: metadataOptions.documentFunction || [],
      authorities: (metadataOptions.issuingAuthorityType || []).flatMap(type => 
        metadataOptions.issuingAuthorityName?.[type] || []
      )
    },
    fallbackMechanisms: [
      "If Pinecone is unavailable, an in-memory vector store is used instead.",
      "If Azure OpenAI embedding fails, a local transformer model generates embeddings.",
      "If both embedding services fail, deterministic embeddings are generated as a last resort."
    ],
    examples: [
      {
        query: "Find human rights documents from KZN",
        metadataExtracted: {
          thematicFocus: "Human_Rights",
          jurisdiction: "KZN"
        },
        explanation: "This query combines semantic similarity with metadata filters for more precise results."
      },
      {
        query: "Show me Constitutional Court judgments about land reform",
        metadataExtracted: {
          issuingAuthority: "Constitutional_Court",
          documentFunction: "Court_Judgement",
          thematicFocus: "Land_Reform"
        },
        explanation: "Multiple metadata filters are combined with semantic search for highly specific results."
      }
    ]
  };
}

/**
 * Extract potential metadata filters from a query
 * @param {string} query - User query text
 * @returns {Object} - Extracted metadata filters
 */
export function extractMetadataFilters(query) {
  const filters = {};
  const queryLower = query.toLowerCase();
  
  // Check for collections
  metadataOptions.collection.forEach(collection => {
    const formattedCollection = collection.replace(/_/g, ' ').toLowerCase();
    if (queryLower.includes(formattedCollection)) {
      filters.collection = collection;
    }
  });
  
  // Check for jurisdictions
  const allJurisdictions = Object.values(metadataOptions.jurisdictionName).flat();
  allJurisdictions.forEach(jurisdiction => {
    const formattedJurisdiction = jurisdiction.replace(/_/g, ' ').toLowerCase();
    if (queryLower.includes(formattedJurisdiction)) {
      filters['structuredPath.jurisdiction.name'] = jurisdiction;
    }
  });
  
  // Check for thematic focus
  metadataOptions.thematicFocusPrimary.forEach(theme => {
    const formattedTheme = theme.replace(/_/g, ' ').toLowerCase();
    if (queryLower.includes(formattedTheme)) {
      filters['structuredPath.thematicFocus.primary'] = theme;
    }
    
    // Also check subthemes
    const subthemes = metadataOptions.thematicFocusSubthemes[theme] || [];
    subthemes.forEach(subtheme => {
      const formattedSubtheme = subtheme.replace(/_/g, ' ').toLowerCase();
      if (queryLower.includes(formattedSubtheme)) {
        if (!filters['structuredPath.thematicFocus.primary']) {
          filters['structuredPath.thematicFocus.primary'] = theme;
        }
        if (!filters['structuredPath.thematicFocus.subthemes']) {
          filters['structuredPath.thematicFocus.subthemes'] = [];
        }
        filters['structuredPath.thematicFocus.subthemes'].push(subtheme);
      }
    });
  });
  
  // Check for document function/type
  metadataOptions.documentFunction.forEach(docType => {
    const formattedDocType = docType.replace(/_/g, ' ').replace(/-/g, ' ').toLowerCase();
    if (queryLower.includes(formattedDocType)) {
      filters['structuredPath.documentFunction'] = docType;
    }
  });
  
  // Check for issuing authorities
  Object.entries(metadataOptions.issuingAuthorityName).forEach(([type, authorities]) => {
    authorities.forEach(authority => {
      const formattedAuthority = authority.replace(/_/g, ' ').toLowerCase();
      if (queryLower.includes(formattedAuthority)) {
        filters['structuredPath.issuingAuthority.type'] = type;
        filters['structuredPath.issuingAuthority.name'] = authority;
      }
    });
  });
  
  return filters;
}

/**
 * Ensure metadata fields match the structure in documents
 * @param {Object} filters - Original metadata filters
 * @returns {Object} - Adjusted filters more likely to match document structure
 */
function adjustMetadataFilters(filters) {
  const adjustedFilters = {};
  
  // Process each filter and try alternative ways to access the same metadata
  Object.entries(filters).forEach(([key, value]) => {
    // Original path
    adjustedFilters[key] = value;
    
    // Try without structuredPath prefix if it has one
    if (key.startsWith('structuredPath.')) {
      const altKey = key.replace('structuredPath.', '');
      adjustedFilters[altKey] = value;
    }
    
    // Try with files prefix for some common fields
    if (key.includes('jurisdiction') || key.includes('thematic') || key.includes('authority')) {
      const altKey = `files.*.structuredPath.${key.replace('structuredPath.', '')}`;
      adjustedFilters[altKey] = value;
    }
    
    // For flattened path structures (some metadata might be stored directly)
    if (key.includes('.')) {
      const parts = key.split('.');
      const flatKey = parts[parts.length - 1];
      adjustedFilters[flatKey] = value;
    }
  });
  
  return adjustedFilters;
}

/**
 * Enhanced query function that combines vector similarity with metadata filtering
 * @param {string} queryText - The user's query
 * @returns {Promise<Array>} - Array of matching documents
 */
export async function queryPineconeWithMetadata(queryText) {
  console.log("[Pinecone] Performing metadata-enhanced query:", queryText);
  
  try {
    // First extract potential metadata filters from the query
    const metadataFilters = extractMetadataFilters(queryText);
    const hasFilters = Object.keys(metadataFilters).length > 0;
    
    if (hasFilters) {
      // Adjust filters to increase chances of matching document structure
      const adjustedFilters = adjustMetadataFilters(metadataFilters);
      console.log("[Pinecone] Extracted and adjusted metadata filters:", adjustedFilters);
      
      // If we have adjustedFilters, try several search strategies
      try {
        // First try with adjusted filters
        const results = await searchWithFilters(queryText, adjustedFilters);
        if (results && results.length > 0) {
          console.log(`[Pinecone] Found ${results.length} results with adjusted filters`);
          return results;
        }
        
        // If no results, try with original filters
        console.log("[Pinecone] No results with adjusted filters, trying original filters");
        const originalResults = await searchWithFilters(queryText, metadataFilters);
        if (originalResults && originalResults.length > 0) {
          console.log(`[Pinecone] Found ${originalResults.length} results with original filters`);
          return originalResults;
        }
        
        // If still no results, try without filters
        console.log("[Pinecone] No results with any filters, trying without filters");
        return await queryPinecone(queryText);
      } catch (error) {
        console.error("[Pinecone] Error during metadata search:", error.message);
        return await queryPinecone(queryText);
      }
    } else {
      // No filters detected, use regular search
      return await queryPinecone(queryText);
    }
  } catch (error) {
    console.error("[Pinecone] Error in metadata-enhanced query:", error.message);
    // Fall back to regular search
    return queryPinecone(queryText);
  }
}

/**
 * Search with specific metadata filters
 */
async function searchWithFilters(queryText, filters) {
  // Extract features for vector similarity search
  const features = await extractFeatures(queryText);
  
  // If Pinecone is available, use it with metadata filtering
  if (pineconeInitialized && index) {
    try {
      const queryResponse = await index.query({
        vector: features,
        topK: 5,
        includeMetadata: true,
        filter: filters
      });
      
      // Process the response
      const results = queryResponse.matches.map(match => {
        const metadata = match.metadata || {};
        return {
          id: match.id,
          text: metadata.text || 'No text available',
          link: metadata.filename,
          score: match.score,
          metadata: metadata
        };
      });
      
      return results;
    } catch (error) {
      console.error("[Pinecone] Error querying Pinecone with filters:", error.message);
      throw error; // Let caller decide whether to retry with different approach
    }
  }
  
  // Memory store fallback with metadata filtering
  if (memoryVectorStore.length > 0) {
    console.log("[Pinecone] Using in-memory store with metadata filtering");
    
    // Recursive function to check if an object matches all filters
    const matchesAllFilters = (obj, filters) => {
      return Object.entries(filters).some(([key, value]) => {
        // Handle nested properties with dot notation
        const keyParts = key.split('.');
        let currentValue = obj;
        
        // Handle wildcard paths like files.*.structuredPath
        if (key.includes('*')) {
          const beforeWildcard = key.split('*')[0].slice(0, -1); // Remove trailing dot
          const afterWildcard = key.split('*')[1].slice(1); // Remove leading dot
          
          // Get the object before wildcard
          let beforeObj = obj;
          if (beforeWildcard) {
            const beforeParts = beforeWildcard.split('.');
            for (const part of beforeParts) {
              beforeObj = beforeObj?.[part];
              if (!beforeObj) return false;
            }
          }
          
          // If it's an object, check all properties
          if (typeof beforeObj === 'object' && beforeObj !== null) {
            // Check if any of the properties match the pattern
            return Object.values(beforeObj).some(val => {
              // Now traverse the path after the wildcard
              let afterObj = val;
              if (afterWildcard) {
                const afterParts = afterWildcard.split('.');
                for (const part of afterParts) {
                  afterObj = afterObj?.[part];
                  if (!afterObj) return false;
                }
              }
              
              return afterObj === value;
            });
          }
          
          return false;
        }
        
        // Standard dot notation traversal
        for (let i = 0; i < keyParts.length; i++) {
          const part = keyParts[i];
          if (currentValue === null || currentValue === undefined) {
            return false;
          }
          currentValue = currentValue[part];
        }
        
        if (Array.isArray(value) && Array.isArray(currentValue)) {
          // For array values, check if any values match
          return value.some(v => currentValue.includes(v));
        }
        
        return currentValue === value;
      });
    };
    
    // Filter memory store
    let filteredStore = memoryVectorStore.filter(entry => 
      matchesAllFilters(entry.metadata, filters)
    );
    
    console.log(`[Pinecone] Filtered memory store by metadata: ${filteredStore.length} matches`);
    
    // Then rank by vector similarity
    const results = filteredStore.map(entry => {
      const dotProduct = features.reduce((sum, val, i) => sum + val * entry.values[i], 0);
      return {
        id: entry.id,
        text: entry.metadata.text,
        link: entry.metadata.filename,
        score: dotProduct,
        metadata: entry.metadata
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
    
    return results;
  }
  
  // If no results through any method, return empty array
  return [];
}

/**
 * Perform a direct metadata search without using embedding vectors
 * @param {Object} filters - Metadata filters extracted from query
 * @returns {Promise<Array>} - Matching documents
 */
export async function performDirectMetadataSearch(filters) {
  console.log("[Pinecone] Performing direct metadata search with filters:", filters);
  
  if (!filters || Object.keys(filters).length === 0) {
    console.log("[Pinecone] No filters provided for direct metadata search");
    return [];
  }
  
  try {
    // Check if we're filtering by a specific political party or organization
    const targetParty = filters['structuredPath.issuingAuthority.name'];
    const isPartySearch = targetParty && 
      metadataOptions.issuingAuthorityName.Political_Parties &&
      metadataOptions.issuingAuthorityName.Political_Parties.includes(targetParty);
    
    if (isPartySearch) {
      console.log(`[Pinecone] Performing strict political party search for: ${targetParty}`);
    }
    
    // Adjust filters to increase chances of matching document structure
    const adjustedFilters = adjustMetadataFilters(filters);
    
    // Set limit for maximum documents to return based on search type
    const maxResults = isPartySearch ? 2 : 3; // Strict limit for party searches
    
    // If Pinecone is available, use metadata filtering
    if (pineconeInitialized && index) {
      try {
        // For exact metadata match, we don't need vector similarity
        const response = await index.query({
          filter: adjustedFilters,
          topK: 10, // Get initial candidates for further filtering
          includeMetadata: true
        });
        
        if (response.matches && response.matches.length > 0) {
          console.log(`[Pinecone] Direct metadata search found ${response.matches.length} initial matches`);
          
          // Apply strict filtering for political parties and organizations
          const strictlyFiltered = response.matches.filter(match => {
            // For political party searches, ensure documents are ONLY from that party
            if (isPartySearch) {
              // Check different possible metadata paths for party/authority information
              const docAuthority = 
                match.metadata?.structuredPath?.issuingAuthority?.name ||
                match.metadata?.issuingAuthority?.name ||
                (match.metadata?.files && Object.values(match.metadata.files).some(
                  file => file?.structuredPath?.issuingAuthority?.name === targetParty
                ));
              
              // Strict matching: if any authority is specified and doesn't match our target, exclude it
              if (!docAuthority) {
                console.log(`[Pinecone] Filtering out document with no authority information`);
                return false;
              } else if (docAuthority !== targetParty) {
                console.log(`[Pinecone] Filtering out document from ${docAuthority} - user requested ${targetParty}`);
                return false;
              }
              
              // Check if the document content also mentions the party (higher relevance)
              return true;
            }
            return true;
          });
          
          console.log(`[Pinecone] After strict filtering: ${strictlyFiltered.length} matches remain`);
          
          // Calculate relevance score based on metadata match quality
          const scoredResults = strictlyFiltered.map(match => {
            let relevanceScore = 1.0; // Base score
            
            // Increase score if document content mentions target party (for party searches)
            if (isPartySearch && match.metadata?.text && 
                match.metadata.text.includes(targetParty)) {
              relevanceScore += 0.5;
            }
            
            // Decrease score slightly for very long documents (may be less focused)
            if (match.metadata?.text && match.metadata.text.length > 10000) {
              relevanceScore -= 0.1;
            }
            
            return {
              id: match.id,
              text: match.metadata?.text || 'No text available',
              link: match.metadata?.filename,
              score: relevanceScore,
              metadata: match.metadata || {}
            };
          });
          
          // Sort by relevance and limit results
          const limitedResults = scoredResults
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
          
          console.log(`[Pinecone] Returning ${limitedResults.length} most relevant documents only`);
          
          return limitedResults;
        }
      } catch (error) {
        console.error("[Pinecone] Error in direct metadata search:", error.message);
      }
    }
    
    // Try in-memory store with strict filtering and result limiting
    if (memoryVectorStore.length > 0) {
      console.log(`[Pinecone] Searching memory store with strict filtering`);
      
      // Filter the in-memory store with explicit party matching
      const filteredResults = memoryVectorStore.filter(entry => {
        // Check basic metadata filters first
        const basicMatch = matchesMetadataFilters(entry.metadata, adjustedFilters);
        if (!basicMatch) return false;
        
        // If this is a political party search, apply very strict party filtering
        if (isPartySearch) {
          // Look for party name in multiple possible locations in the metadata
          const docAuthority = 
            entry.metadata?.structuredPath?.issuingAuthority?.name ||
            entry.metadata?.issuingAuthority?.name;
          
          // For party filtering, require an exact match
          if (docAuthority !== targetParty) {
            return false;
          }
          
          // Also check if any files in the document match the target party
          if (entry.metadata?.files) {
            const fileMatch = Object.values(entry.metadata.files).some(
              file => file?.structuredPath?.issuingAuthority?.name === targetParty
            );
            if (!fileMatch && docAuthority !== targetParty) {
              return false;
            }
          }
        }
        
        return true;
      });
      
      // Apply relevance scoring similar to Pinecone results
      const scoredResults = filteredResults.map(entry => {
        let relevanceScore = 1.0;
        
        // Check for party mentions in text for party searches
        if (isPartySearch && entry.metadata.text && 
            entry.metadata.text.includes(targetParty)) {
          relevanceScore += 0.5;
        }
        
        // Slight penalty for very long documents
        if (entry.metadata.text && entry.metadata.text.length > 10000) {
          relevanceScore -= 0.1;
        }
        
        return {
          id: entry.id,
          text: entry.metadata.text || 'No text available',
          link: entry.metadata.filename,
          score: relevanceScore,
          metadata: entry.metadata
        };
      });
      
      // Sort by relevance and limit results
      const limitedResults = scoredResults
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
      
      console.log(`[Pinecone] Memory store found ${filteredResults.length} matches, returning ${limitedResults.length} most relevant`);
      return limitedResults;
    }
    
    return [];
  } catch (error) {
    console.error("[Pinecone] Error in direct metadata search:", error.message);
    return [];
  }
}

/**
 * Sort and filter documents by relevance score 
 * @param {Array} docs - Documents to filter
 * @param {number} threshold - Minimum relevance score (0-1)
 * @returns {Array} - Filtered and sorted documents
 */
export function sortAndFilterByRelevance(docs, threshold = 0.6) {
  if (!docs || !Array.isArray(docs)) return [];
  
  // Sort by score descending
  const sorted = [...docs].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Filter by threshold if specified
  if (threshold > 0) {
    return sorted.filter(doc => (doc.score || 0) >= threshold);
  }
  
  return sorted;
}


/**
 * Delete all vectors whose IDs start with `prefix` in the given namespace.
 * Uses listPaginated + deleteMany (serverless indexes only).
 */
export async function deleteByPrefix(prefix, namespace = 'Chunky') {
  console.log('[Pinecone] deleteByPrefix args →', { prefix, namespace });
  const ns = pc.index(PINECONE_INDEX_NAME, PINECONE_INDEX_HOST).namespace(namespace);

  let paginationToken = undefined;
  const allIds = [];
  do {
    console.log('[Pinecone] listPaginated args →', { prefix, limit: 100, paginationToken });
    const page = await ns.listPaginated({ prefix, limit: 100, paginationToken });
    console.log('[Pinecone] listPaginated result →', page);
    const pageIds = (page.vectors||[]).map(v => v.id);
    allIds.push(...pageIds);
    paginationToken = page.pagination?.next;
  } while (paginationToken);

  console.log('[Pinecone] Collected IDs →', allIds);

  if (allIds.length === 0) {
    console.log(`[Pinecone] No vectors found with prefix "${prefix}"`);
    return { deletedCount: 0 };
  }

  // Batch delete them
  await ns.deleteMany(allIds);
  console.log(`[Pinecone] Deleted ${allIds.length} vectors with prefix "${prefix}"`);
  return { deletedCount: allIds.length };
}



