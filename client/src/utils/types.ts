/**
 * Common type definitions for the application
 */

export interface Source {
  text: string;
  link: string | null;
  sasUrl?: string | null;
  documentNumber?: number;
  originalLink?: string;
  // Add relevant metadata fields for filtering
  metadata?: {
    issuingAuthority?: {
      type?: string;
      name?: string;
    };
    thematicFocus?: {
      primary?: string;
      subthemes?: string[];
    };
    structuredPath?: Record<string, any>;
    [key: string]: any;
  };
  relevanceScore?: number;
}

export interface Metadata {
  detectedFilters?: Record<string, string>;
  documentsFound?: number;
  documentType?: string;
  date?: string;
  score?: number;
  // Add filter status for UI feedback
  appliedFilters?: {
    name: string;
    value: string;
    matches: number;
  }[];
}

export interface AnswerResponse {
  answer: string;
  sources: Source[];
  error?: string;
  sessionId?: string;
  conversationHistory?: Array<{role: string, content: string}>;
  metadata?: Metadata;
  isConversational?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  metadata?: Metadata;
  error?: boolean;
  isIntroduction?: boolean;
}
