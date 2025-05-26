import React, { useState, useEffect, useRef } from 'react';
import DocumentChat from '../components/DocumentChat';

// Define types for better readability and safety
interface SearchResult {
  isUser: boolean;
  text: string;
  metadata?: {
    documentType?: string;
    date?: string;
    score?: number;
  };
  link?: string;
}

const HomePage: React.FC = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [queryMade, setQueryMade] = useState(false); // Consider if this state is still needed
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // Consider if this state is still needed
  const [animateHeading, setAnimateHeading] = useState(false);
  const [animateTags, setAnimateTags] = useState(false);
  const [animateChat, setAnimateChat] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [chatInput, setChatInput] = useState<string>('');
  const documentClickRef = useRef(false); // Consider if this ref is still needed
  const [autoSubmit, setAutoSubmit] = useState(false);

  const AUTOCOMPLETE_SUGGESTIONS = [
    "Bill of Rights",
    "Children Rights",
    "Health Care Laws",
    "Laws for Education",
    "Constitutional Court",
    "Truth and Reconciliation Commission",
    "Freedom Charter",
    "Human Rights",
    "Constitutional Amendments",
    "Judicial Review"
  ];

  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [chatExpanded]);

  const handleExampleClick = (example: string) => {
    setChatInput(example);
    setChatExpanded(true);
    setAutoSubmit(true);
  };

  const handleTagClick = (tag: string) => {
    setChatInput(tag);
    setChatExpanded(true);
    setAutoSubmit(true);
  };

  const handleTagRemove = (tag: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tag));
  };

  // Function to handle changes in the chat input from DocumentChat
  const handleChatInputChange = (value: string) => {
    setChatInput(value);
    if (value.length > 0) {
      const filtered = AUTOCOMPLETE_SUGGESTIONS.filter(s =>
        s.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  // Function to handle after submission is complete (from DocumentChat)
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
        <h1 className="gentle-float text-3xl md:text-5xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          Discover Historical Archives
        </h1>
        <p className="text-base md:text-lg text-gray-400 max-w-md mx-auto">
          Explore South Africa's constitutional history through curated archives.
        </p>
      </header>

      {/* DocumentChat Component with minimized state until Enter is pressed */}
      <section
        className={`w-full transition-all duration-700 ease-out origin-center ${
          animateChat ? 'opacity-100' : 'opacity-0'
        } ${
          chatExpanded
            ? 'max-w-6xl h-auto scale-100 pt-16 my-8'
            : 'max-w-lg h-16 my-4 scale-95 cursor-pointer'
        } overflow-hidden rounded-lg border border-gray-700`}
        onClick={() => !chatExpanded && setChatExpanded(true)}
        aria-expanded={chatExpanded}
        aria-controls="document-chat-interface"
      >
        {chatExpanded ? (
          <DocumentChat
            initialInput={chatInput}
            onInputChange={handleChatInputChange}
            autoSubmit={autoSubmit}
            onSubmitComplete={handleSubmitComplete}
            filteredSuggestions={filteredSuggestions}
            showSuggestions={showSuggestions}
            setChatInput={setChatInput}
            setShowSuggestions={setShowSuggestions}
          />
        ) : (
          <p className="flex items-center justify-center h-full bg-gray-800 hover:bg-gray-700 transition-colors text-gray-300">
            Click anywhere or press Enter to start searching archives...
          </p>
        )}
      </section>

      {/* Chat Log Section - Enhanced with better formatting and animation */}
      {results.length > 0 && (
        <section
          className="custom-scrollbar mt-10 w-full max-w-6xl h-96 overflow-y-auto bg-gray-900 p-4 rounded-md animate-fadeIn"
          aria-label="Search Results"
        >
          <h2 className="sr-only">Search Results</h2> {/* Hidden heading for accessibility */}
          <ul className="space-y-4"> {/* Use ul for list of results */}
            {results.map((result, index) => (
              <li
                key={index}
                className={`p-4 rounded-3xl animate-slideUp ${
                  result.isUser
                    ? 'bg-blue-600 text-white ml-auto max-w-[80%]'
                    : 'bg-gray-800 text-white mr-auto max-w-[80%]'
                }`}
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {result.isUser ? (
                  <p className="text-lg text-right">
                    <strong className="font-bold">You asked:</strong> {result.text}
                  </p>
                ) : (
                  <article> {/* Use article for self-contained result */}
                    <p className="text-lg mb-2 text-left">{result.text}</p>
                    {result.metadata && (
                      <footer className="text-sm text-gray-400 mt-1 text-left">
                        {result.metadata.documentType && (
                          <span className="mr-3">Type: {result.metadata.documentType}</span>
                        )}
                        {result.metadata.date && (
                          <span className="mr-3">Date: {result.metadata.date}</span>
                        )}
                        {result.metadata.score && (
                          <span>Relevance: {Math.round(result.metadata.score * 100)}%</span>
                        )}
                      </footer>
                    )}
                    {result.link && (
                      <a
                        href={result.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline mt-2 block text-left"
                      >
                        View Document
                      </a>
                    )}
                  </article>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Loading Indicator */}
      {loading && (
        <section className="mt-6 flex items-center justify-center" aria-live="polite" aria-busy="true">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          <p className="ml-3 text-gray-400">Searching archives...</p>
        </section>
      )}

      {/* Error Display */}
      {error && <p className="mt-4 text-red-500" role="alert">{error}</p>}

      {/* Popular Tags Section with improved animation and auto-fill on click */}
      <section
        className={`mt-10 space-y-4 max-w-4xl mx-auto px-4 transition-all duration-700 ease-out ${
          animateTags ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
        }`}
        aria-label="Popular search tags"
      >
        <h2 className="text-lg font-semibold text-gray-300 sr-only">Popular Search Tags</h2> {/* Hidden heading for accessibility */}
        <nav aria-label="Examples of search queries"> {/* Use nav for semantic grouping of example queries */}
          <ul className="flex flex-wrap justify-center gap-3">
            {/* Top Row: 4 tags */}
            {[
              'Children Rights',
              'Health Care Laws',
              'Laws for Education',
              'Constitutional Court',
            ].map((tag, index) => (
              <li key={tag}> {/* Each tag button is a list item */}
                <button
                  onClick={() => handleTagClick(tag)}
                  className="px-4 py-2 text-sm md:text-base border border-blue-500 text-blue-500 rounded-full hover:bg-blue-500 hover:text-white transition-all focus:ring-2 focus:ring-blue-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
          {/* Bottom Row: 3 tags including TRC */}
          <ul className="flex flex-wrap justify-center gap-3 mt-3"> {/* New ul for bottom row for distinct grouping if desired */}
            {[
              'Truth and Reconciliation Commission',
              'Freedom Charter',
              'Human Rights',
            ].map((tag, index) => (
              <li key={tag}> {/* Each tag button is a list item */}
                <button
                  onClick={() => handleTagClick(tag)}
                  className="px-4 py-2 text-sm md:text-base border border-blue-500 text-blue-500 rounded-full hover:bg-blue-500 hover:text-white transition-all focus:ring-2 focus:ring-blue-300"
                  style={{ animationDelay: `${(index + 4) * 100}ms` }}
                >
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </main>
  );
};

export default HomePage;