import React, { useState, useEffect, useRef } from 'react';
import DocumentChat from '../components/DocumentChat';

const HomePage = () => {
  const [results, setResults] = useState<any[]>([]); // State to store search results
  const [error, setError] = useState<string | null>(null); // State to store errors
  const [loading, setLoading] = useState<boolean>(false); // State to track loading status
  const [queryMade, setQueryMade] = useState(false); // State to track if a query was made
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // State to track selected tags
  const [animateHeading, setAnimateHeading] = useState(false); // State for heading animation
  const [animateTags, setAnimateTags] = useState(false); // State for tags animation
  const [animateChat, setAnimateChat] = useState(false); // State for DocumentChat animation
  const [chatExpanded, setChatExpanded] = useState(false); // State to track if chat is expanded
  const [chatInput, setChatInput] = useState(''); // State to track what should be in the chat input
  const documentClickRef = useRef(false);
  const [autoSubmit, setAutoSubmit] = useState(false); // State to track if we should auto-submit

  useEffect(() => {
    // Staggered animation sequence
    setAnimateHeading(true); // Trigger heading animation immediately
    setTimeout(() => setAnimateChat(true), 300); // Delay chat animation
    setTimeout(() => setAnimateTags(true), 500); // Delay tag animation

    // Add event listener for Enter key to expand the chat
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !chatExpanded) {
        setChatExpanded(true);
      }
    };

    // Add event listener for any click to expand the chat
    const handleDocumentClick = () => {
      if (!chatExpanded && documentClickRef.current) {
        setChatExpanded(true);
      }
      // Set ref to true after initial render to prevent auto-expansion
      documentClickRef.current = true;
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleDocumentClick);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [chatExpanded]);

  const handleTagClick = (tag: string) => {
    // Set the input to the tag value
    setChatInput(tag);
    // Ensure the chat is expanded
    setChatExpanded(true);
    // Set the flag to trigger auto-submission in DocumentChat
    setAutoSubmit(true);

    // Add tag to selectedTags if not already there (optional, based on your UI needs)
    if (!selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag]);
    }
  };

  const handleTagRemove = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  // Function to handle changes in the chat input from DocumentChat
  const handleChatInputChange = (value: string) => {
    setChatInput(value);
  };

  // Function to handle after submission is complete
  const handleSubmitComplete = () => {
    setAutoSubmit(false); // Reset auto-submit flag
  };

  return (
    <main className="flex flex-col items-center text-center px-4 pt-20">
      {/* Animated Heading with improved animation */}
      <header
        className={`transform transition-all duration-700 ease-out ${
          animateHeading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        } flex flex-col items-center text-center`}
      >
        <h2 className="text-3xl md:text-5xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          Discover Historical Archives
        </h2>
        <p className="text-base md:text-lg text-gray-400 max-w-md mx-auto">
          Explore South Africa's constitutional history through curated archives.
        </p>
      </header>

      {/* DocumentChat Component with minimized state until Enter is pressed */}
      <div 
        className={`w-full transition-all duration-700 ease-out origin-center ${
          animateChat ? 'opacity-100' : 'opacity-0'
        } ${
          chatExpanded 
            ? 'max-w-6xl h-auto my-8 scale-100'
            : 'max-w-lg h-16 my-4 scale-95 cursor-pointer'
        } overflow-hidden rounded-lg border border-gray-700`}
        onClick={() => !chatExpanded && setChatExpanded(true)}
      >
        {chatExpanded ? (
          <DocumentChat 
            initialInput={chatInput}
            onInputChange={handleChatInputChange}
            autoSubmit={autoSubmit}
            onSubmitComplete={handleSubmitComplete}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-800 hover:bg-gray-700 transition-colors text-gray-300">
            <p>Click anywhere or press Enter to start searching archives...</p>
          </div>
        )}
      </div>
      
      {/* Chat Log Section - Enhanced with better formatting and animation */}
      {results.length > 0 && (
        <section className="custom-scrollbar mt-10 w-full max-w-6xl h-96 overflow-y-auto bg-gray-900 p-4 rounded-md animate-fadeIn">
          {results.map((result, index) => (
            <div
              key={index}
              className={`mb-4 p-4 rounded-3xl ${
                result.isUser
                  ? 'bg-blue-600 text-white self-end text-right ml-auto w-fit'
                  : 'bg-gray-800 text-white self-start text-left w-fit max-w-[80%]'
              } animate-slideUp`}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              {result.isUser ? (
                <p className="text-lg">
                  <span className="font-bold">You asked:</span> {result.text}
                </p>
              ) : (
                <>
                  <p className="text-lg mb-2">{result.text}</p>
                  {result.metadata && (
                    <div className="text-sm text-gray-400 mt-1">
                      {result.metadata.documentType && (
                        <span className="mr-3">Type: {result.metadata.documentType}</span>
                      )}
                      {result.metadata.date && (
                        <span className="mr-3">Date: {result.metadata.date}</span>
                      )}
                      {result.metadata.score && (
                        <span>Relevance: {Math.round(result.metadata.score * 100)}%</span>
                      )}
                    </div>
                  )}
                  {result.link && (
                    <a
                      href={result.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline mt-2 block"
                    >
                      View Document
                    </a>
                  )}
                </>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="mt-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-400">Searching archives...</span>
        </div>
      )}

      {/* Error Display */}
      {error && <p className="mt-4 text-red-500">{error}</p>}

      {/* Popular Tags Section with improved animation and auto-fill on click */}
      <section
        className={`flex flex-wrap gap-4 justify-center max-w-2xl mt-8 transition-all duration-700 ease-out ${
          animateTags ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
      >
        {['Children Rights', 'Health Care Laws', 'Laws for Education', 'Truth and Reconciliation Commission', 'Freedom Charter', 'Constitutional Court', 'Human Rights'].map((tag, index) => (
          <button
            key={tag}
            className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-500 hover:text-white transition-all hover:scale-105 focus:ring-2 focus:ring-blue-300"
            onClick={() => handleTagClick(tag)}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {tag}
          </button>
        ))}
      </section>
    </main>
  );
};

export default HomePage;
