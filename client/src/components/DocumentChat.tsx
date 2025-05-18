import React, { useState, useEffect, useRef } from 'react';
import { askQuestion } from '../utils/api';
import { AnswerResponse, Source, Metadata } from '../utils/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  metadata?: Metadata;
  error?: boolean;
  isIntroduction?: boolean;
}

const DocumentChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [metadataFilters, setMetadataFilters] = useState<Record<string, string>>({});

  // Add a welcome message when component first loads
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: 'Hello! I can help you find and understand South African constitutional documents. What would you like to know?',
      isIntroduction: true
    }]);
  }, []);

  // Auto-scroll to the bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    
    // Show loading state
    setIsLoading(true);
    
    try {
      // Check if this is a direct search for a specific topic by exact name
      const isDirectTopicSearch = /^(truth_and_reconciliation_commission|land_reform|human_rights|constitutional_court)$/i.test(
        userMessage.trim().replace(/\s+/g, '_')
      );
      
      // Get previous messages for context (limit to last 6 messages)
      const recentMessages = messages
        .slice(-6)
        .filter(msg => !msg.isIntroduction)
        .map(msg => ({ role: msg.role, content: msg.content }));
      
      // Send query to server with conversation history
      const response = await askQuestion(
        userMessage, 
        sessionId, 
        recentMessages, 
        metadataFilters,
        isDirectTopicSearch ? { enforceExactMatch: true } : undefined
      );
      
      // Update session ID if provided
      if (response.sessionId) {
        setSessionId(response.sessionId);
      }
      
      // Store detected metadata filters if available
      if (response.metadata?.detectedFilters) {
        setMetadataFilters(response.metadata.detectedFilters);
      }
      
      // Add AI response to chat
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response.answer,
        sources: response.sources || [],
        metadata: response.metadata
      }]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.',
        error: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-gray-800 rounded-lg shadow-lg">
      <div className="flex flex-col h-[70vh]">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 mb-4 custom-scrollbar">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : message.error
                      ? 'bg-red-700 text-white'
                      : 'bg-gray-700 text-white'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* Display sources if available */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <div className="text-sm font-semibold text-gray-300">Sources:</div>
                    <div className="space-y-2 mt-1">
                      {message.sources.map((source, idx) => (
                        <div key={idx} className="text-xs text-gray-300">
                          <div className="italic line-clamp-2">{source.text}</div>
                          {source.sasUrl ? (
                            <a 
                              href={source.sasUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:underline"
                            >
                              View Document {source.documentNumber ? `(#${source.documentNumber})` : ''}
                            </a>
                          ) : source.link ? (
                            <span className="text-gray-400">
                              {source.link}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Display metadata info if available */}
                {message.metadata && (
                  <div className="mt-2 text-xs text-gray-400">
                    {message.metadata?.documentsFound ? 
                      `Found ${message.metadata.documentsFound} relevant documents` : 
                      'No specific document count available'}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            className="flex-1 bg-gray-700 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ask about South African constitutional documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`p-3 rounded-lg ${
              isLoading || !input.trim() 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default DocumentChat;
