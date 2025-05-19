/**
 * Utility functions for making API requests
 */

import { AnswerResponse } from './types';
import axios from 'axios';

// Interface for the source object
export interface Source {
  text: string;
  link: string | null;
}

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

/**
 * Simple function to check if the API server is reachable
 * @returns {Promise<boolean>} True if the server is reachable
 */
export async function pingServer(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/test`);
    return response.ok;
  } catch (error) {
    console.error('Server ping failed:', error);
    return false;
  }
}

/**
 * Send a question to the RAG system with conversation history
 * @param {string} question - The user's question
 * @param {string} sessionId - Optional session ID for conversation continuity
 * @param {Array} conversationHistory - Optional array of previous conversation messages
 * @param {Object} metadataFilters - Optional metadata filters to apply
 * @param {Object} options - Additional query options
 * @returns {Promise<AnswerResponse>} - The answer and sources
 */
export const askQuestion = async (
  question: string,
  sessionId?: string | null,
  conversationHistory?: { role: string; content: string }[],
  metadataFilters?: Record<string, string>,
  options?: {
    enforceExactMatch?: boolean;
    maxResults?: number;
    systemMessage?: { role: string; content: string };
  }
): Promise<AnswerResponse> => {
  try {
    // Include system message if provided
    const messages = [...(conversationHistory || [])];
    
    // Add system message at the start if provided
    if (options?.systemMessage) {
      messages.unshift(options.systemMessage);
    }
    
    const response = await axios.post('/api/question', {
      question,
      sessionId,
      conversationHistory: messages,
      metadataFilters: metadataFilters || {},
      enforceExactMatch: options?.enforceExactMatch || false,
      maxResults: options?.maxResults || 5
    });

    return response.data;
  } catch (error) {
    console.error('Error asking question:', error);
    throw error;
  }
};

/**
 * Query Pinecone for documents
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of matching documents
 */
export async function queryPinecone(query: string): Promise<any[]> {
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
