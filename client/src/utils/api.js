/**
 * Utility functions for making API requests
 */

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:5000/api';

/**
 * Send a question to the RAG system
 * @param {string} question - The user's question
 * @returns {Promise<Object>} - The answer and sources
 */
export async function askQuestion(question) {
  try {
    const response = await fetch(`${API_BASE_URL}/pinecone/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * Query Pinecone for documents
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of matching documents
 */
export async function queryPinecone(query) {
  try {
    const response = await fetch(`${API_BASE_URL}/pinecone/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ queryText: query }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
