import React, { useState, useEffect, useRef } from 'react';
import { askQuestion } from '../utils/api';

const ConversationalRAG = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message to conversation
    setConversation(prev => [...prev, { role: 'user', content: input }]);
    
    const userQuestion = input;
    setInput('');
    setLoading(true);
    setError(null);

    try {
      // Extract conversation history for the API
      const conversationHistory = conversation.slice(-6); // Last 6 messages for context
      
      // Call the API with conversation context
      const response = await askQuestion(userQuestion, sessionId, conversationHistory);
      
      // Update session ID if provided
      if (response.sessionId) {
        setSessionId(response.sessionId);
      }
      
      // Add AI response to conversation
      setConversation(prev => [...prev, { 
        role: 'assistant', 
        content: response.answer,
        sources: response.sources || []
      }]);
      
    } catch (err) {
      console.error('Error getting answer:', err);
      setError('Failed to get a response. Please try again.');
      
      // Add error message to conversation
      setConversation(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error while processing your question. Please try again.',
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-gray-900 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-white">Constitutional Archives Chat</h2>
      
      {/* Conversation Display */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4 h-96 overflow-y-auto">
        {conversation.length === 0 ? (
          <div className="text-gray-400 text-center py-10">
            <p>Ask a question about South African constitutional history or legal documents.</p>
            <p className="mt-2 text-sm">Try questions like "Find documents about human rights" or "Show me legal documents related to land reform"</p>
          </div>
        ) : (
          conversation.map((msg, idx) => (
            <div 
              key={idx} 
              className={`mb-4 p-3 rounded-lg ${
                msg.role === 'user' 
                  ? 'bg-blue-900 text-white ml-10' 
                  : 'bg-gray-700 text-gray-200 mr-10'
              } ${msg.error ? 'bg-red-900' : ''}`}
            >
              <p>{msg.content}</p>
              
              {/* Sources listing */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 border-t border-gray-600 pt-2">
                  <p className="text-sm font-bold text-gray-400">Sources:</p>
                  <div className="max-h-40 overflow-y-auto">
                    {msg.sources.map((source, sourceIdx) => (
                      <div key={sourceIdx} className="mt-1 text-sm text-gray-400">
                        <p className="text-xs italic">{source.text}</p>
                        {(source.sasUrl || source.link) && (
                          <a 
                            href={source.sasUrl || source.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline text-xs"
                          >
                            View document {source.sasUrl ? '(signed link)' : ''}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about constitutional documents..."
          className="flex-grow p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : 'Send'}
        </button>
      </form>
      
      {/* Session indicator */}
      {sessionId && (
        <div className="mt-2 text-xs text-gray-500">
          Session ID: {sessionId.slice(0, 8)}...
        </div>
      )}
    </div>
  );
};

export default ConversationalRAG;
