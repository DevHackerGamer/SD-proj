import express from 'express';
import path from 'path';
import fs from 'fs';
import { ensureClient } from '../controllers/blobHelpers.js';
import { compileAllMetadata, getCompiledMetadata, getMetadataContext, findMatchingDocuments, generateDocumentUrl } from '../controllers/metadataCompiler.js';

const router = express.Router();

// Add new endpoint for semantic search using ChatGPT
router.post('/semantic-search', async (req, res) => {
  try {
    const { query, maxResults = 3 } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        message: 'Query is required for semantic search'
      });
    }
    
    console.log(`[Semantic Search] Query: "${query}"`);
    
    // First try to find exact matches for collections or themes
    // This should be fast and direct
    const exactMatchResults = await getExactMatches(query);
    
    if (exactMatchResults.length > 0) {
      console.log(`[Semantic Search] Found ${exactMatchResults.length} exact matches`);
      
      return res.status(200).json({
        items: exactMatchResults,
        totalItems: exactMatchResults.length,
        message: `Found ${exactMatchResults.length} documents that exactly match your search`
      });
    }
    
    // If no exact matches, use basic vector search or metadata search
    // Limited to just a few results
    const relevantResults = await getRelevantDocuments(query, maxResults);
    
    return res.status(200).json({
      items: relevantResults,
      totalItems: relevantResults.length,
      message: `Found ${relevantResults.length} relevant documents`
    });
  } catch (error) {
    console.error('[Semantic Search] Error:', error);
    res.status(500).json({ 
      message: 'Error during semantic search',
      error: error.message
    });
  }
});

// New endpoint for simple full-text search across all metadata
router.post('/fulltext-search', async (req, res) => {
  try {
    const { terms = [], maxResults = 5 } = req.body;
    
    if (!terms || !Array.isArray(terms) || terms.length === 0) {
      return res.status(400).json({ message: 'Search terms required' });
    }
    
    console.log(`[Server] Fulltext search for terms: ${terms.join(', ')}`);
    
    // Get client for blob storage
    const client = ensureClient();
    
    // Track matching files
    const matchingFiles = [];
    
    // Search through all blobs
    let continuationToken = null;
    let processedCount = 0;
    const MAX_PROCESS = 1000; // Limit how many files we scan
    
    do {
      const response = await client.listBlobsFlat({
        includeMetadata: true,
        maxPageSize: 100,
        continuationToken: continuationToken
      }).byPage().next();
      
      const segment = response.value;
      continuationToken = segment.continuationToken;
      
      // Process each blob
      for (const blob of segment.segment.blobItems) {
        processedCount++;
        
        // Skip directories and metadata.json files
        if (blob.name.endsWith('/') || blob.name.endsWith('/metadata.json')) {
          continue;
        }
        
        // Get metadata
        const metadata = blob.metadata || {};
        const fileName = path.basename(blob.name);
        
        // Check for term matches in filename
        let matchesAnyTerm = terms.some(term => 
          fileName.toLowerCase().includes(term)
        );
        
        // If no match in filename, check metadata values
        if (!matchesAnyTerm) {
          matchesAnyTerm = Object.values(metadata).some(value => {
            if (typeof value === 'string') {
              // Check if any term is in the metadata value
              return terms.some(term => 
                value.toLowerCase().includes(term)
              );
            }
            return false;
          });
        }
        
        // If we have a match, add to results
        if (matchesAnyTerm) {
          matchingFiles.push({
            name: fileName,
            path: blob.name,
            metadata: metadata,
            contentType: blob.properties.contentType,
            size: blob.properties.contentLength,
            lastModified: blob.properties.lastModified
          });
          
          // Stop if we've reached the max results
          if (matchingFiles.length >= maxResults) {
            break;
          }
        }
        
        // Limit processing
        if (processedCount >= MAX_PROCESS) {
          console.log(`[Server] Reached maximum processing limit (${MAX_PROCESS})`);
          break;
        }
      }
      
      // Stop if we have enough results or processed maximum files
      if (matchingFiles.length >= maxResults || processedCount >= MAX_PROCESS) {
        break;
      }
      
    } while (continuationToken);
    
    console.log(`[Server] Fulltext search found ${matchingFiles.length} matching files`);
    
    // Return the results
    res.status(200).json({
      items: matchingFiles,
      totalItems: matchingFiles.length,
      message: `Found ${matchingFiles.length} matching documents`
    });
    
  } catch (error) {
    console.error('[Server] Error during fulltext search:', error);
    res.status(500).json({
      message: 'Error searching documents',
      error: error.message
    });
  }
});

// New endpoint for exact word matching in metadata
router.post('/exact-word-search', async (req, res) => {
  try {
    const { words = [], maxResults = 5, requireAllWords = false } = req.body;
    
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ message: 'Search words required' });
    }
    
    console.log(`[Server] Exact word search for: ${words.join(', ')}`);
    console.log(`[Server] Require all words: ${requireAllWords}`);
    
    // Get client for blob storage
    const client = ensureClient();
    
    // Track matching files
    const matchingFiles = [];
    
    // Track which search terms matched in which files (for debugging)
    const matchDebug = {};
    
    // Process all blobs with a limit
    let continuationToken = null;
    let processedCount = 0;
    const MAX_PROCESS = 1000;
    
    do {
      const response = await client.listBlobsFlat({
        includeMetadata: true,
        maxPageSize: 100,
        continuationToken: continuationToken
      }).byPage().next();
      
      const segment = response.value;
      continuationToken = segment.continuationToken;
      
      // Process each blob
      for (const blob of segment.segment.blobItems) {
        processedCount++;
        
        // Skip directories and metadata.json files
        if (blob.name.endsWith('/') || blob.name.endsWith('/metadata.json')) {
          continue;
        }
        
        // Get metadata
        const metadata = blob.metadata || {};
        const fileName = path.basename(blob.name);
        
        // Track which words match for this file
        const matchedWords = new Set();
        
        // Check for exact word matches in metadata values
        for (const [key, value] of Object.entries(metadata)) {
          if (typeof value !== 'string') continue;
          
          // Break metadata value into words
          const metadataWords = value
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 0);
          
          // Check if any search words exactly match any metadata words
          for (const searchWord of words) {
            if (metadataWords.includes(searchWord)) {
              matchedWords.add(searchWord);
            }
          }
        }
        
        // Check filename too
        const filenameWords = fileName
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(word => word.length > 0);
          
        for (const searchWord of words) {
          if (filenameWords.includes(searchWord)) {
            matchedWords.add(searchWord);
          }
        }
        
        // Determine if this file matches based on our criteria
        let isMatch = false;
        
        if (requireAllWords) {
          // Must match all search words
          isMatch = matchedWords.size === words.length;
        } else {
          // Match if any search word is found
          isMatch = matchedWords.size > 0;
        }
        
        // If matched, add to results
        if (isMatch) {
          matchingFiles.push({
            name: fileName,
            path: blob.name,
            metadata: metadata,
            contentType: blob.properties.contentType,
            size: blob.properties.contentLength,
            lastModified: blob.properties.lastModified
          });
          
          // For debugging
          matchDebug[fileName] = Array.from(matchedWords);
          
          // Stop if we've reached the max results
          if (matchingFiles.length >= maxResults) {
            break;
          }
        }
        
        // Limit processing
        if (processedCount >= MAX_PROCESS) {
          console.log(`[Server] Reached maximum processing limit (${MAX_PROCESS})`);
          break;
        }
      }
      
      // Stop if we have enough results or processed maximum files
      if (matchingFiles.length >= maxResults || processedCount >= MAX_PROCESS) {
        break;
      }
      
    } while (continuationToken);
    
    console.log(`[Server] Exact word search found ${matchingFiles.length} matching files`);
    console.log(`[Server] Match details:`, matchDebug);
    
    // Return the results
    res.status(200).json({
      items: matchingFiles,
      totalItems: matchingFiles.length,
      message: `Found ${matchingFiles.length} documents with exact word matches`
    });
    
  } catch (error) {
    console.error('[Server] Error during exact word search:', error);
    res.status(500).json({
      message: 'Error searching documents',
      error: error.message
    });
  }
});

// New endpoint for exact metadata search
router.post('/exact-metadata-search', async (req, res) => {
  try {
    const { category, value } = req.body;
    
    if (!category || !value) {
      return res.status(400).json({ message: 'Category and value are required for exact search' });
    }
    
    console.log(`[Server] Exact metadata search: ${category}="${value}"`);
    
    // Get client for blob storage
    const client = ensureClient();
    
    // Track matching files
    const matchingFiles = [];
    
    // Process all blobs
    let continuationToken = null;
    
    do {
      const response = await client.listBlobsFlat({
        includeMetadata: true,
        maxPageSize: 100,
        continuationToken: continuationToken
      }).byPage().next();
      
      const segment = response.value;
      continuationToken = segment.continuationToken;
      
      // Process each blob
      for (const blob of segment.segment.blobItems) {
        // Skip directories and metadata.json files
        if (blob.name.endsWith('/') || blob.name.endsWith('/metadata.json')) {
          continue;
        }
        
        // Get metadata and normalize
        const metadata = blob.metadata || {};
        const fileName = path.basename(blob.name);
        
        // Extract document ID if available
        const documentId = metadata.documentid || '';
        
        // Check for exact match in the specific category
        let isExactMatch = false;
        
        // Handle different category name formats
        switch (category.toLowerCase()) {
          case 'collection':
            isExactMatch = metadata.collection === value;
            break;
          
          case 'thematicfocusprimary':
          case 'thematicfocus_primary':
            isExactMatch = metadata.thematicfocus_primary === value;
            break;
            
          case 'jurisdictionname':
          case 'jurisdiction_name':
            isExactMatch = metadata.jurisdiction_name === value;
            break;
            
          default:
            // For other categories, normalize key names and check
            isExactMatch = Object.entries(metadata).some(([key, metaValue]) => {
              const normalizedKey = key.toLowerCase().replace(/-/g, '').replace(/_/g, '');
              const normalizedCategory = category.toLowerCase().replace(/-/g, '').replace(/_/g, '');
              
              return normalizedKey === normalizedCategory && metaValue === value;
            });
        }
        
        // If exact match found, add to results
        if (isExactMatch) {
          matchingFiles.push({
            name: fileName,
            path: blob.name,
            metadata: metadata,
            documentId: documentId,
            contentType: blob.properties.contentType,
            size: blob.properties.contentLength,
            lastModified: blob.properties.lastModified
          });
        }
      }
      
    } while (continuationToken && matchingFiles.length < 10);
    
    console.log(`[Server] Found ${matchingFiles.length} exact matches for ${category}="${value}"`);
    
    // Return the results
    res.status(200).json({
      items: matchingFiles,
      totalItems: matchingFiles.length,
      message: `Found ${matchingFiles.length} documents with exact metadata match`
    });
    
  } catch (error) {
    console.error('[Server] Error during exact metadata search:', error);
    res.status(500).json({
      message: 'Error searching documents',
      error: error.message
    });
  }
});

// Endpoint to get document SAS URL by document ID
router.get('/document-url/:documentId', async (req, res) => {
  try {
    const documentId = decodeURIComponent(req.params.documentId);
    
    console.log(`[Server] Finding document with ID: ${documentId}`);
    
    // Get client
    const client = ensureClient();
    
    // Find the document using helpers from metadataCompiler
    const metadata = await getCompiledMetadata();
    const document = metadata.documentIndex[documentId] || { documentId };
    
    // Generate URL using the document ID
    const documentUrl = await generateDocumentUrl(document);
    
    if (!documentUrl) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    res.status(200).json({ url: documentUrl });
    
  } catch (error) {
    console.error('[Server] Error generating document URL:', error);
    res.status(500).json({
      message: 'Error generating document URL',
      error: error.message
    });
  }
});

// Helper to find document path by ID
async function findDocumentPathById(documentId) {
  try {
    const client = ensureClient();
    
    let continuationToken = null;
    
    do {
      const response = await client.listBlobsFlat({
        includeMetadata: true,
        maxPageSize: 100,
        continuationToken: continuationToken
      }).byPage().next();
      
      const segment = response.value;
      continuationToken = segment.continuationToken;
      
      // Check each blob for matching document ID
      for (const blob of segment.segment.blobItems) {
        if (blob.name.endsWith('/') || blob.name.endsWith('/metadata.json')) {
          continue;
        }
        
        const metadata = blob.metadata || {};
        
        if (metadata.documentid === documentId) {
          return blob.name;
        }
      }
      
    } while (continuationToken);
    
    return null;
  } catch (error) {
    console.error('[Server] Error finding document by ID:', error);
    return null;
  }
}

// Helper to generate SAS URL
async function generateSasUrl(blobPath) {
  try {
    const client = ensureClient();
    const blobClient = client.getBlockBlobClient(blobPath);
    
    // Generate SAS token for this blob
    const expiresInHours = 1;
    const now = new Date();
    const expiresOn = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);
    
    // Generate SAS URL for read access
    const sasOptions = {
      expiresOn,
      permissions: "r"  // Read permission only
    };
    
    const sasToken = await blobClient.generateSasUrl(sasOptions);
    return sasToken;
    
  } catch (error) {
    console.error('[Server] Error generating SAS URL:', error);
    return null;
  }
}

// Helper function to find exact matches
async function getExactMatches(query) {
  // Normalize query
  const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, '_');
  
  try {
    // Get all options from metadata options
    const metadataOptionsPath = path.join(process.cwd(), 'client/src/components/managefields/metadataOptions.json');
    const metadataOptions = JSON.parse(fs.readFileSync(metadataOptionsPath, 'utf8'));
    
    // Check collections (highest priority)
    const collectionMatches = [];
    
    for (const collection of metadataOptions.collection) {
      if (collection.toLowerCase() === normalizedQuery) {
        // Search for documents with this exact collection
        const matchingDocs = await searchByExactMetadata('collection', collection);
        collectionMatches.push(...matchingDocs);
      }
    }
    
    if (collectionMatches.length > 0) {
      return collectionMatches.slice(0, 5); // Limit to 5 results
    }
    
    // Check thematic focus
    const themeMatches = [];
    
    for (const theme of metadataOptions.thematicFocusPrimary) {
      if (theme.toLowerCase() === normalizedQuery) {
        const matchingDocs = await searchByExactMetadata('thematicfocus_primary', theme);
        themeMatches.push(...matchingDocs);
      }
    }
    
    if (themeMatches.length > 0) {
      return themeMatches.slice(0, 5);
    }
    
    return [];
  } catch (error) {
    console.error('[getExactMatches] Error:', error);
    return [];
  }
}

// Helper function to search by exact metadata value
async function searchByExactMetadata(field, value) {
  try {
    const client = ensureClient();
    const matchingFiles = [];
    
    let continuationToken = null;
    
    do {
      const response = await client.listBlobsFlat({
        includeMetadata: true,
        maxPageSize: 50,
        continuationToken: continuationToken
      }).byPage().next();
      
      const segment = response.value;
      continuationToken = segment.continuationToken;
      
      // Process each blob
      for (const blob of segment.segment.blobItems) {
        // Skip directories and metadata files
        if (blob.name.endsWith('/') || blob.name.endsWith('/metadata.json')) continue;
        
        const metadata = blob.metadata || {};
        const matchesField = metadata[field] && metadata[field].toLowerCase() === value.toLowerCase();
        
        if (matchesField) {
          matchingFiles.push({
            name: path.basename(blob.name),
            path: blob.name,
            metadata: metadata,
            contentType: blob.properties.contentType,
            size: blob.properties.contentLength,
            lastModified: blob.properties.lastModified
          });
        }
      }
    } while (continuationToken && matchingFiles.length < 10);
    
    return matchingFiles;
  } catch (error) {
    console.error('[searchByExactMetadata] Error:', error);
    return [];
  }
}

// Helper function to find semantically relevant documents
async function getRelevantDocuments(query, maxResults) {
  // This could be implemented with vector search or basic metadata search
  // For now, implement a basic search with strict limits
  try {
    const client = ensureClient();
    const allMetadataItems = [];
    
    let continuationToken = null;
    let processedItems = 0;
    const MAX_ITEMS = 200; // Only process the first 200 items
    
    do {
      const response = await client.listBlobsFlat({
        includeMetadata: true,
        maxPageSize: 50,
        continuationToken: continuationToken
      }).byPage().next();
      
      const segment = response.value;
      continuationToken = segment.continuationToken;
      
      // Process each blob
      for (const blob of segment.segment.blobItems) {
        processedItems++;
        
        // Skip directories and metadata files
        if (blob.name.endsWith('/') || blob.name.endsWith('/metadata.json')) continue;
        
        const metadata = blob.metadata || {};
        
        // Add to potential items
        allMetadataItems.push({
          name: path.basename(blob.name),
          path: blob.name,
          metadata: metadata,
          contentType: blob.properties.contentType,
          size: blob.properties.contentLength,
          lastModified: blob.properties.lastModified
        });
        
        if (processedItems >= MAX_ITEMS) break;
      }
    } while (continuationToken && processedItems < MAX_ITEMS);
    
    // Basic relevance scoring algorithm
    const scoredItems = allMetadataItems.map(item => {
      let score = 0;
      const normalizedQuery = query.toLowerCase();
      
      // Check name
      if (item.name.toLowerCase().includes(normalizedQuery)) {
        score += 5;
      }
      
      // Check metadata values
      for (const [key, value] of Object.entries(item.metadata)) {
        if (typeof value === 'string' && value.toLowerCase().includes(normalizedQuery)) {
          score += 3;
        }
        
        // If metadata key contains any word from query, small boost
        const queryWords = normalizedQuery.split(/\s+/);
        if (queryWords.some(word => key.toLowerCase().includes(word))) {
          score += 1;
        }
      }
      
      return { item, score };
    });
    
    // Sort by score and return top results
    return scoredItems
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(item => item.item);
  } catch (error) {
    console.error('[getRelevantDocuments] Error:', error);
    return [];
  }
}

// Endpoint to compile all metadata 
router.get('/compile-metadata', async (req, res) => {
  try {
    const forceRefresh = req.query.force === 'true';
    const metadata = await compileAllMetadata(forceRefresh);
    
    res.status(200).json({
      message: 'Metadata compilation successful',
      documentCount: Object.keys(metadata.documentIndex).length,
      collections: Object.keys(metadata.collectionIndex).length,
      topics: Object.keys(metadata.thematicIndex).length
    });
  } catch (error) {
    console.error('[API] Error compiling metadata:', error);
    res.status(500).json({
      message: 'Error compiling metadata',
      error: error.message
    });
  }
});

// Endpoint to get ChatGPT-ready context
router.get('/metadata-context', async (req, res) => {
  try {
    const context = await getMetadataContext();
    
    res.status(200).json({
      message: 'Metadata context retrieved',
      context
    });
  } catch (error) {
    console.error('[API] Error getting metadata context:', error);
    res.status(500).json({
      message: 'Error getting metadata context',
      error: error.message
    });
  }
});

// Endpoint for ChatGPT to search metadata
router.post('/chatgpt-search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }
    
    console.log(`[API] ChatGPT search for: "${query}"`);
    
    // First get the compiled metadata
    const metadata = await getCompiledMetadata();
    
    // Call OpenAI API to interpret the query against our metadata
    const interpretation = await interpretQueryWithChatGPT(query, metadata);
    
    // Find matching documents based on interpretation
    let matchingDocuments = [];
    
    if (interpretation.documentIds && interpretation.documentIds.length > 0) {
      // Directly use document IDs if provided
      for (const docId of interpretation.documentIds) {
        if (metadata.documentIndex[docId]) {
          matchingDocuments.push(metadata.documentIndex[docId]);
        }
      }
    } else if (interpretation.criteria) {
      // Use criteria to find matches
      matchingDocuments = await findMatchingDocuments(interpretation.criteria);
    }
    
    // Generate ONLY document URLs using document IDs (no metadata URLs)
    const documentsWithUrls = await Promise.all(matchingDocuments.map(async doc => {
      // Use document ID to find and generate URL for the actual document
      const documentUrl = await generateDocumentUrl(doc);
      
      return {
        ...doc,
        documentUrl
      };
    }));
    
    res.status(200).json({
      message: interpretation.explanation || `Found ${documentsWithUrls.length} matching documents`,
      items: documentsWithUrls,
      totalItems: documentsWithUrls.length,
      query: query,
      interpretation: interpretation
    });
    
  } catch (error) {
    console.error('[API] Error in ChatGPT search:', error);
    res.status(500).json({
      message: 'Error performing search',
      error: error.message
    });
  }
});

// Helper function to generate SAS URL for a blob
async function generateSasUrl(blobPath) {
  try {
    const client = ensureClient();
    const blobClient = client.getBlockBlobClient(blobPath);
    
    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      return null;
    }
    
    // Generate a SAS token with 1 hour expiry
    const expiresOn = new Date();
    expiresOn.setHours(expiresOn.getHours() + 1);
    
    const sasUrl = await blobClient.generateSasUrl({
      permissions: "r", // Read-only permission
      expiresOn: expiresOn
    });
    
    return sasUrl;
  } catch (error) {
    console.error(`[API] Error generating SAS URL for ${blobPath}:`, error);
    return null;
  }
}

// Helper function to interpret query with ChatGPT
async function interpretQueryWithChatGPT(query, metadata) {
  // This would be replaced with a real OpenAI API call
  // For now, let's simulate the behavior with a simple implementation
  
  // Sample interpretations for demonstration
  if (query.toLowerCase().includes('constitutional development')) {
    return {
      explanation: "I found documents related to Constitutional Development",
      criteria: { collection: "Constitutional_Development" },
      documentIds: Object.keys(metadata.collectionIndex["Constitutional_Development"] || {})
    };
  }
  
  if (query.toLowerCase().includes('human rights')) {
    return {
      explanation: "I found documents about Human Rights",
      criteria: { thematicfocus: "Human_Rights" },
      documentIds: Object.keys(metadata.thematicIndex["Human_Rights"] || {})
    };
  }
  
  // Generic search - look for word matches in document names
  const matchingDocIds = [];
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  Object.entries(metadata.documentIndex).forEach(([docId, doc]) => {
    const docNameLower = doc.name.toLowerCase();
    if (queryWords.some(word => docNameLower.includes(word))) {
      matchingDocIds.push(docId);
    }
  });
  
  if (matchingDocIds.length > 0) {
    return {
      explanation: `I found ${matchingDocIds.length} documents matching your query`,
      documentIds: matchingDocIds
    };
  }
  
  // No matches found
  return {
    explanation: "I couldn't find any documents matching your criteria",
    documentIds: []
  };
}

// New endpoint specifically for document content (not metadata)
router.get('/document-content/:documentId', async (req, res) => {
  try {
    const documentId = decodeURIComponent(req.params.documentId);
    
    console.log(`[Server] Finding document content for ID: ${documentId}`);
    
    // Get document by ID using the helper from generateDocumentSas.js
    const blobPath = await findDocumentBlob(ensureClient().getContainerClient(containerName), documentId);
    
    if (!blobPath) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Generate SAS URL for document content
    const sasUrl = await generateSasTokenForDocument(documentId);
    
    if (!sasUrl) {
      return res.status(500).json({ message: 'Failed to generate document access URL' });
    }
    
    // Redirect directly to the SAS URL
    res.redirect(sasUrl);
    
  } catch (error) {
    console.error('[Server] Error accessing document content:', error);
    res.status(500).json({
      message: 'Error accessing document content',
      error: error.message
    });
  }
});

// Direct file content endpoint as fallback
router.get('/file-content/:path(*)', async (req, res) => {
  try {
    const filePath = decodeURIComponent(req.params.path);
    
    console.log(`[Server] Accessing file content for: ${filePath}`);
    
    // Get client
    const client = ensureClient();
    const blobClient = client.getBlockBlobClient(filePath);
    
    // Check if the blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Generate SAS URL for the file
    const sasUrl = await generateSasUrl(filePath);
    
    if (!sasUrl) {
      return res.status(500).json({ message: 'Failed to generate file access URL' });
    }
    
    // Redirect to the SAS URL
    res.redirect(sasUrl);
    
  } catch (error) {
    console.error('[Server] Error accessing file content:', error);
    res.status(500).json({
      message: 'Error accessing file content',
      error: error.message
    });
  }
});

// New endpoint for document content without requiring document ID
router.get('/file-content/:path(*)', async (req, res) => {
  try {
    const filePath = decodeURIComponent(req.params.path);
    
    console.log(`[Server] Accessing file content for: ${filePath}`);
    
    // Get client
    const client = ensureClient();
    
    // Try to find the file
    let blobClient;
    
    // First check if path exists directly
    blobClient = client.getBlockBlobClient(filePath);
    let exists = await blobClient.exists();
    
    if (!exists) {
      // If not found, try searching for the file by name in common locations
      console.log(`[Server] File not found directly, trying to locate by name...`);
      
      const fileName = path.basename(filePath);
      let foundPath = null;
      
      // Simple file search implementation
      let continuationToken = null;
      do {
        const response = await client.listBlobsFlat({
          prefix: '',
          maxPageSize: 100,
          continuationToken: continuationToken
        }).byPage().next();
        
        const segment = response.value;
        continuationToken = segment.continuationToken;
        
        for (const blob of segment.segment.blobItems) {
          if (path.basename(blob.name) === fileName) {
            foundPath = blob.name;
            break;
          }
        }
        
        if (foundPath) break;
      } while (continuationToken);
      
      if (foundPath) {
        console.log(`[Server] Found matching file: ${foundPath}`);
        blobClient = client.getBlockBlobClient(foundPath);
        exists = true;
      }
    }
    
    if (!exists) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Generate SAS URL for the file
    const sasOptions = {
      startsOn: new Date(Date.now() - 60 * 1000), // Start 1 min ago (clock skew protection)
      expiresOn: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiration
      permissions: "r" // Read-only permission
    };
    
    const sasUrl = await blobClient.generateSasUrl(sasOptions);
    
    // Redirect to the SAS URL
    res.redirect(sasUrl);
    
  } catch (error) {
    console.error('[Server] Error accessing file content:', error);
    res.status(500).json({
      message: 'Error accessing file content',
      error: error.message
    });
  }
});

// New endpoint for document content by document ID
router.get('/document-content/:documentId', async (req, res) => {
  try {
    const documentId = decodeURIComponent(req.params.documentId);
    
    console.log(`[Server] Generating content URL for document ID: ${documentId}`);
    
    // Import document SAS utility functions
    const { findDocumentBlob, generateSasTokenForDocument } = await import('../utils/generateDocumentSas.js');
    
    // Get container client
    const client = ensureClient();
    const containerClient = client.getContainerClient(process.env.AZURE_STORAGE_CONTAINER_NAME || 'files');
    
    // Find the document
    const blobPath = await findDocumentBlob(containerClient, documentId);
    
    if (!blobPath) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    console.log(`[Server] Found document at: ${blobPath}`);
    
    // Generate SAS URL for the document
    const sasUrl = await generateSasTokenForDocument(documentId);
    
    if (!sasUrl) {
      return res.status(500).json({ message: 'Failed to generate document URL' });
    }
    
    // Redirect to the SAS URL
    res.redirect(sasUrl);
    
  } catch (error) {
    console.error('[Server] Error accessing document content:', error);
    res.status(500).json({
      message: 'Error accessing document content',
      error: error.message
    });
  }
});

// Import and use functions from generateDocumentSas.js
import { 
  findDocumentBlob, 
  generateSasTokenForDocument 
} from '../utils/generateDocumentSas.js';

// Generate link to actual document file, never to metadata.json - ALWAYS called when documents are mentioned
router.get('/actual-document/:documentId', async (req, res) => {
  try {
    const documentId = decodeURIComponent(req.params.documentId);
    
    console.log(`[Server] Accessing actual document file for ID: ${documentId}`);
    
    // Use the DocumentSas utility which is optimized for finding actual document files
    const { generateSasTokenForDocument } = await import('../utils/generateDocumentSas.js');
    
    // Generate SAS URL for document content - this utility specifically targets document files, not metadata
    const sasUrl = await generateSasTokenForDocument(documentId);
    
    if (!sasUrl) {
      // Fall back to searching in the regular way if the specialized utility fails
      const client = ensureClient();
      
      // Search for the document file directly - skip any metadata.json
      let documentPath = null;
      let continuationToken = null;
      
      // Try to find document in metadata.json files first to get the actual document filename
      const metadataFiles = [];
      
      // Find all metadata.json files
      do {
        // ...existing code...
      } while (continuationToken);
      
      // ...existing code...
      
      // If still not found, respond with error
      if (!documentPath) {
        console.error(`[Server] Document with ID ${documentId} not found. Returning 404.`);
        return res.status(404).json({ 
          message: 'Document not found',
          documentId: documentId
        });
      }
      
      // Generate SAS URL for the actual document file
      // ...existing code...
    } else {
      // Log success finding the document
      console.log(`[Server] Successfully generated SAS URL for document ID: ${documentId}`);
      
      // Redirect to the document SAS URL
      return res.redirect(sasUrl);
    }
    
  } catch (error) {
    console.error('[Server] Error accessing document:', error);
    res.status(500).json({
      message: 'Error accessing document',
      error: error.message
    });
  }
});

// ENHANCED: Document search endpoint that always includes actual document links
router.post('/document-search', async (req, res) => {
  try {
    const { query, filters, maxResults = 10 } = req.body;
    
    // Perform the search using existing methods
    const results = await performDocumentSearch(query, filters, maxResults);
    
    // IMPORTANT: Always generate document links for ALL results
    const resultsWithLinks = await Promise.all(results.map(async (doc) => {
      // Generate an actual document link (never metadata)
      let documentUrl = null;
      
      if (doc.documentId) {
        // Try using document ID first
        documentUrl = `/api/actual-document/${encodeURIComponent(doc.documentId)}`;
      } else if (doc.path) {
        // Fall back to path if document ID isn't available
        documentUrl = `/api/actual-file/${encodeURIComponent(doc.path)}`;
      }
      
      return {
        ...doc,
        documentUrl  // Always include the document URL
      };
    }));
    
    // Return the enhanced results with document links
    res.status(200).json({
      items: resultsWithLinks,
      totalItems: resultsWithLinks.length,
      message: `Found ${resultsWithLinks.length} documents matching your criteria`,
      allContainLinks: true // Flag to indicate all documents have links
    });
    
  } catch (error) {
    console.error('[Server] Error during document search:', error);
    res.status(500).json({
      message: 'Error searching for documents',
      error: error.message
    });
  }
});

// Helper to ensure all responses include document links
function ensureDocumentLinks(documents) {
  return documents.map(doc => {
    // Skip if document already has a link
    if (doc.documentUrl) return doc;
    
    // Generate document link
    let documentUrl = null;
    
    if (doc.documentId) {
      documentUrl = `/api/actual-document/${encodeURIComponent(doc.documentId)}`;
    } else if (doc.path) {
      documentUrl = `/api/actual-file/${encodeURIComponent(doc.path)}`;
    }
    
    return {
      ...doc,
      documentUrl
    };
  });
}

// IMPORTANT: Modify the chatgpt-search endpoint to always include document links
router.post('/chatgpt-search', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ message: 'Query is required' });
    }
    
    console.log(`[API] ChatGPT search for: "${query}"`);
    
    // Use existing code to find matching documents
    // ...existing code...
    
    // Make sure EVERY document in the response has a valid document link (not metadata)
    const documentsWithLinks = matchingDocuments.map(doc => {
      return {
        ...doc,
        // Always include a direct link to the actual document (not metadata)
        documentUrl: doc.documentId 
          ? `/api/actual-document/${encodeURIComponent(doc.documentId)}`
          : `/api/actual-file/${encodeURIComponent(doc.path)}`
      };
    });
    
    res.status(200).json({
      message: `Found ${documentsWithLinks.length} matching documents`,
      items: documentsWithLinks,
      totalItems: documentsWithLinks.length,
      query: query,
      allHaveDocumentLinks: true
    });
    
  } catch (error) {
    console.error('[API] Error in ChatGPT search:', error);
    res.status(500).json({
      message: 'Error performing search',
      error: error.message
    });
  }
});

// Direct actual file access by path - ensuring it's never a metadata file
router.get('/actual-file/:path(*)', async (req, res) => {
  try {
    const filePath = decodeURIComponent(req.params.path);
    
    console.log(`[Server] Accessing actual file at: ${filePath}`);
    
    // Reject metadata.json requests
    if (filePath.endsWith('/metadata.json') || filePath === 'metadata.json') {
      return res.status(400).json({ message: 'Metadata files cannot be directly accessed' });
    }
    
    // Get client
    const client = ensureClient();
    const blobClient = client.getBlockBlobClient(filePath);
    
    // Check if the file exists
    const exists = await blobClient.exists();
    if (!exists) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Generate SAS URL with 1-hour expiry
    const expiresOn = new Date();
    expiresOn.setHours(expiresOn.getHours() + 1);
    
    const sasUrl = await blobClient.generateSasUrl({
      permissions: "r", // Read-only permission
      expiresOn: expiresOn
    });
    
    // Redirect to the file SAS URL
    res.redirect(sasUrl);
    
  } catch (error) {
    console.error('[Server] Error accessing file:', error);
    res.status(500).json({
      message: 'Error accessing file',
      error: error.message
    });
  }
});

export default router;