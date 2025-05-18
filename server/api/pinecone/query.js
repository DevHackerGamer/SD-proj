const { PineconeClient } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Pinecone client
const pinecone = new PineconeClient();
pinecone.init({
  environment: process.env.PINECONE_ENVIRONMENT || 'us-west1-gcp',
  apiKey: process.env.PINECONE_API_KEY,
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Handles search queries using Pinecone vector database with NLP processing
 */
module.exports = async (req, res) => {
  try {
    const { queryText, topK = 5, chainWithAI = true } = req.body;
    
    if (!queryText) {
      return res.status(400).json({ error: 'Query text is required' });
    }

    // Step 1: Extract metadata filters from natural language query using GPT
    const extractedFilters = await extractFiltersFromQuery(queryText);
    console.log('Extracted filters from query:', extractedFilters);

    // Step 2: Generate embeddings using text-embedding-3-small model
    const queryEmbedding = await getQueryEmbedding(queryText);
    
    // Step 3: Connect to the Pinecone index
    const indexName = process.env.PINECONE_INDEX_NAME || 'constitutional-archives';
    const index = pinecone.Index(indexName);
    
    // Step 4: Query Pinecone with the embedding and extracted metadata filters
    const queryResponse = await index.query({
      queryVector: queryEmbedding,
      topK,
      filter: extractedFilters,
      includeMetadata: true,
    });

    // Step 5: Process the results to make them more frontend-friendly
    const matches = queryResponse.matches.map(match => ({
      id: match.id,
      text: match.metadata.contentSummary || 'No summary available',
      metadata: match.metadata,
      score: match.score,
      link: generateDocumentLink(match.id, match.metadata),
    }));

    // Step 6: Optionally enhance results with ChatGPT
    let aiSummary = null;
    let queryAnalysis = null;
    
    if (chainWithAI && matches.length > 0) {
      const aiResponse = await enhanceResultsWithAI(queryText, matches, extractedFilters);
      aiSummary = aiResponse.summary;
      queryAnalysis = aiResponse.analysis;
    }

    // Return the results
    res.status(200).json({
      matches,
      aiSummary,
      queryAnalysis,
      extractedFilters,
      totalResults: matches.length,
    });
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    res.status(500).json({ error: 'Failed to query the database.' });
  }
};

/**
 * Extract metadata filters from natural language query using GPT-3.5-turbo
 */
async function extractFiltersFromQuery(queryText) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a metadata extraction system for a South African constitutional archive. 
          Extract relevant search metadata from the query into a JSON object with these fields:
          - structuredPath.collection: e.g., Constitutional_Development, Truth_Reconciliation, Historical_Records
          - structuredPath.jurisdiction.name: e.g., National, KZN, Western_Cape, Gauteng
          - structuredPath.thematicFocus.primary: e.g., Human_Rights, Democracy, Justice, Equality
          - structuredPath.documentFunction: e.g., bill-draft, legislation, judgment, testimony, report
          - accessLevel: e.g., public, restricted
          - timeframe: extract date ranges (pre-apartheid <1948, apartheid 1948-1994, post-apartheid >1994)
          
          Only include fields that are clearly mentioned or implied in the query. Format values exactly as shown in examples.
          Return ONLY the JSON object without explanations.`
        },
        {
          role: "user",
          content: queryText
        }
      ],
      temperature: 0.1,
    });

    // Parse the JSON response
    const jsonResponse = JSON.parse(completion.choices[0].message.content);
    
    // Convert the extracted timeframe to actual date filters if present
    if (jsonResponse.timeframe) {
      const timeframeMapping = {
        'pre-apartheid': { $lt: '1948-01-01' },
        'apartheid': { $gte: '1948-01-01', $lt: '1994-04-27' },
        'post-apartheid': { $gte: '1994-04-27' }
      };
      
      const timeframeFilter = timeframeMapping[jsonResponse.timeframe];
      if (timeframeFilter) {
        jsonResponse['structuredPath.item.publicationDate'] = timeframeFilter;
      }
      
      // Remove the timeframe property as it's not a direct filter
      delete jsonResponse.timeframe;
    }
    
    return jsonResponse;
  } catch (error) {
    console.error('Error extracting filters from query:', error);
    // Return empty filters if extraction fails
    return {};
  }
}

/**
 * Get vector embedding for a query text using text-embedding-3-small
 */
async function getQueryEmbedding(queryText) {
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: queryText,
      dimensions: 1536, // Adjust to match your Pinecone index dimensions
    });
    return embeddingResponse.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Fallback mock embedding (for testing)
    return Array(1536).fill(0).map(() => Math.random() - 0.5);
  }
}

/**
 * Generate a link to view the document
 */
function generateDocumentLink(documentId, metadata) {
  const fileName = metadata?.structuredPath?.item?.fileName || 'document';
  return `/api/documents/${documentId}/${encodeURIComponent(fileName)}`;
}

/**
 * Enhance results with AI analysis using GPT-3.5-turbo
 */
async function enhanceResultsWithAI(queryText, matches, extractedFilters) {
  try {
    // Extract relevant information from matches
    const matchSummaries = matches.map(match => {
      const metadata = match.metadata;
      const path = metadata.structuredPath || {};
      
      return `
Document: ${path.item?.fileName || 'Unnamed document'}
Type: ${path.documentFunction || 'Unknown type'}
Collection: ${path.collection || 'Unknown collection'}
Theme: ${path.thematicFocus?.primary || 'Unknown theme'}
Access Level: ${metadata.accessLevel || 'Unknown access level'}
Publication Date: ${path.item?.publicationDate || 'Unknown date'}
Summary: ${metadata.contentSummary || 'No summary available'}
Relevance Score: ${Math.round(match.score * 100)}%
      `;
    }).join('\n---\n');

    // Generate enhanced analysis with ChatGPT
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant specialized in South African constitutional history and legal documents. 
          Provide two sections in your response:
          1. ANALYSIS: A brief analysis of what the user is looking for based on their query and the extracted filters.
          2. SUMMARY: A concise summary of the search results, highlighting the most relevant information related to the query.
          
          Format your response with these exact section headers.`
        },
        {
          role: "user",
          content: `Query: "${queryText}"
          
Extracted Filters: ${JSON.stringify(extractedFilters)}

Search Results:
${matchSummaries}

Please analyze my query and summarize these results.`
        }
      ],
      max_tokens: 500,
    });

    const response = completion.choices[0].message.content;
    
    // Extract the analysis and summary sections
    const analysisSectionMatch = response.match(/ANALYSIS:(.*?)(?=SUMMARY:)/s);
    const summarySectionMatch = response.match(/SUMMARY:(.*)/s);
    
    return {
      analysis: analysisSectionMatch ? analysisSectionMatch[1].trim() : null,
      summary: summarySectionMatch ? summarySectionMatch[1].trim() : response.trim()
    };
  } catch (error) {
    console.error('Error enhancing results with AI:', error);
    return { summary: null, analysis: null };
  }
}
