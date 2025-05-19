import axios from 'axios';
import metadataOptions from '../components/managefields/metadataOptions.json';

// Interface for search results
export interface SearchResult {
  items: Array<{
    documentId: string;
    name: string;
    path: string;
    collection: string;
    thematicfocus: string;
    documentUrl: string;
    metadataUrl: string;
    [key: string]: any;
  }>;
  totalItems: number;
  message: string;
  query: string;
  interpretation?: any;
}

/**
 * Search documents using ChatGPT with metadata context
 */
export const searchDocuments = async (query: string): Promise<SearchResult> => {
  try {
    console.log("SearchApi: Searching with ChatGPT for:", query);
    
    // Use the ChatGPT metadata search endpoint
    const response = await axios.post('/api/chatgpt-search', {
      query: query
    });
    
    // Log the number of items returned
    if (response.data && response.data.items) {
      console.log(`SearchApi: Found ${response.data.items.length} documents via ChatGPT metadata search`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
};

/**
 * Check if query exactly matches any metadata value
 */
function isExactMetadataMatch(query: string): { found: boolean, category: string, value: string } {
  const normalizedQuery = query.toLowerCase().trim();
  
  // Check collection names
  for (const collection of metadataOptions.collection) {
    if (normalizedQuery === collection.toLowerCase().replace(/_/g, ' ')) {
      return { found: true, category: 'collection', value: collection };
    }
  }
  
  // Check thematic focus
  for (const focus of metadataOptions.thematicFocusPrimary) {
    if (normalizedQuery === focus.toLowerCase().replace(/_/g, ' ')) {
      return { found: true, category: 'thematicFocusPrimary', value: focus };
    }
  }
  
  // Check jurisdictions
  for (const [type, locations] of Object.entries(metadataOptions.jurisdictionName)) {
    for (const location of locations) {
      if (normalizedQuery === location.toLowerCase().replace(/_/g, ' ')) {
        return { found: true, category: 'jurisdictionName', value: location };
      }
    }
  }
  
  // No exact match found
  return { found: false, category: '', value: '' };
}
