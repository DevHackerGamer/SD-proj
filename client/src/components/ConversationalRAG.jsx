import React, { useState, useEffect, useRef } from 'react';
import { askQuestion } from '../utils/api';

// Define types for better type safety
interface Source {
  text: string;
  sasUrl?: string;
  link?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  error?: boolean;
}

const ConversationalRAG: React.FC = () => {
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  useEffect(() => {
    // Add initial welcome message
    setConversation([{
      role: 'assistant',
      content: 'Hello! Ask me anything about South African constitutional history or legal documents.'
    }]);
  }, []); // Run only once on component mount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userQuestion = input;
    setInput('');
    setLoading(true);
    setError(null);

    // Add user message to conversation immediately
    setConversation(prev => [...prev, { role: 'user', content: userQuestion }]);

    try {
      // Extract conversation history for the API (last 6 messages for context)
      // Ensure we don't include the initial welcome message in history sent to backend if it's treated differently
      const conversationHistory = conversation.slice(-6).map(msg => ({ role: msg.role, content: msg.content }));

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

      // Add error message to conversation for the user
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
    <main className="w-full max-w-4xl mx-auto p-4 bg-gray-900 rounded-lg shadow-lg">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-white">Constitutional Archives Chat</h1>
      </header>

      {/* Conversation Display */}
      <section
        className="bg-gray-800 rounded-lg p-4 mb-4 h-96 overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-atomic="false"
      >
        {conversation.length <= 1 ? ( // Only the initial welcome message
          <div className="text-gray-400 text-center py-10">
            <p>Ask a question about South African constitutional history or legal documents.</p>
            <p className="mt-2 text-sm">Try questions like "Find documents about human rights" or "Show me legal documents related to land reform"</p>
          </div>
        ) : (
          <ul className="space-y-4"> {/* Use ul for semantic list of messages */}
            {conversation.map((msg, idx) => (
              <li
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <article
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-blue-900 text-white ml-10'
                      : 'bg-gray-700 text-gray-200 mr-10'
                  } ${msg.error ? 'bg-red-900' : ''}`}
                  aria-label={`${msg.role} message`}
                >
                  <p>{msg.content}</p>

                  {/* Sources listing */}
                  {msg.sources && msg.sources.length > 0 && (
                    <footer className="mt-2 border-t border-gray-600 pt-2">
                      <h3 className="sr-only">Sources:</h3> {/* Visually hidden heading for accessibility */}
                      <ul className="max-h-40 overflow-y-auto space-y-1"> {/* Use ul for source list */}
                        {msg.sources.map((source, sourceIdx) => (
                          <li key={sourceIdx} className="text-sm text-gray-400">
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
                          </li>
                        ))}
                      </ul>
                    </footer>
                  )}
                </article>
              </li>
            ))}
          </ul>
        )}
        <div ref={messagesEndRef} /> {/* Still need this div for the scroll reference */}
      </section>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2" aria-label="Send message">
        <label htmlFor="chat-input" className="sr-only">Your message</label>
        <input
          id="chat-input"
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
          aria-label={loading ? "Sending message" : "Send message"}
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
        <p className="mt-2 text-xs text-gray-500"> {/* Changed from div to p */}
          Session ID: {sessionId.slice(0, 8)}...
        </p>
      )}
    </main>
  );
};

export default ConversationalRAG;