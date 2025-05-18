import React, { useState, useEffect } from 'react';
import { askQuestion } from '../utils/api';
import { AnswerResponse, Source } from '../utils/types';

const QuestionAnswering: React.FC = () => {
  const [question, setQuestion] = useState<string>('');
  const [answer, setAnswer] = useState<AnswerResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSources, setShowSources] = useState<boolean>(false);
  const [requestTime, setRequestTime] = useState<number | null>(null);
  const [serverConnected, setServerConnected] = useState<boolean>(true);

  // Check server connection on component mount
  useEffect(() => {
    const checkServerConnection = async () => {
      try {
        const response = await fetch('/api/test');
        setServerConnected(response.ok);
      } catch (error) {
        setServerConnected(false);
        console.error('Server connection error:', error);
      }
    };
    
    checkServerConnection();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }
    
    setError(null);
    setLoading(true);
    const startTime = Date.now();
    
    try {
      const response = await askQuestion(question.trim());
      const endTime = Date.now();
      setRequestTime(endTime - startTime);
      setAnswer(response as AnswerResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Ask about South African constitutional archives</h2>
      <p className="text-gray-400 mb-4">Powered by Azure OpenAI Service</p>
      
      {!serverConnected && (
        <div className="mb-4 p-3 bg-yellow-900/50 border border-yellow-800 rounded-md text-yellow-100">
          Warning: Server connection issue. The app may not function correctly.
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question about South African constitutional history..."
            className="flex-grow p-3 rounded-md bg-gray-800 text-white border border-gray-700 focus:border-blue-500 focus:outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Ask'}
          </button>
        </div>
      </form>
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-md text-red-100">
          {error}
        </div>
      )}
      
      {loading && (
        <div className="flex items-center justify-center gap-2 my-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="text-gray-400">Finding answer...</span>
        </div>
      )}
      
      {answer && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-800 rounded-md">
            <h3 className="text-xl font-semibold mb-2 text-white">Answer:</h3>
            <p className="text-gray-300 whitespace-pre-line">{answer.answer}</p>
            {requestTime && (
              <p className="text-xs text-gray-500 mt-2">Response time: {requestTime}ms</p>
            )}
          </div>
          
          {answer.sources && answer.sources.length > 0 && (
            <div>
              <button
                onClick={() => setShowSources(!showSources)}
                className="flex items-center gap-1 text-blue-400 hover:underline"
              >
                <span>{showSources ? 'Hide' : 'Show'} Sources</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-4 w-4 transition-transform ${showSources ? 'rotate-180' : ''}`}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showSources && (
                <div className="mt-2 space-y-2">
                  <h3 className="text-lg font-semibold">Sources:</h3>
                  {answer.sources.map((source: Source, index: number) => (
                    <div key={index} className="p-3 bg-gray-800 rounded-md">
                      <p className="text-sm text-gray-400">{source.text}</p>
                      {source.link && (
                        <a 
                          href={source.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline text-sm mt-1 block"
                        >
                          View Document
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionAnswering;
