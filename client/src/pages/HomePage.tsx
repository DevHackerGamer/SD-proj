import React, { useState, useEffect } from 'react';

const HomePage = () => {
  const [results, setResults] = useState<any[]>([]); // State to store search results
  const [error, setError] = useState<string | null>(null); // State to store errors
  const [loading, setLoading] = useState<boolean>(false); // State to track loading status
  const [queryMade, setQueryMade] = useState(false); // State to track if a query was made
  const [selectedTags, setSelectedTags] = useState<string[]>([]); // State to track selected tags
  const [searchQuery, setSearchQuery] = useState<string>(''); // State for the search input
  const [animateHeading, setAnimateHeading] = useState(false); // State for heading animation
  const [animateTags, setAnimateTags] = useState(false); // State for tags animation


  useEffect(() => {
    setAnimateHeading(true); // Trigger heading animation on mount
    setTimeout(() => setAnimateTags(true), 500); // Delay tag animation for a smoother effect
  }, []);

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!searchQuery.trim() && selectedTags.length === 0) {
      setError('Search query cannot be empty.');
      return;
    }

    setError(null); // Clear previous errors
    setLoading(true); // Set loading to true
    setQueryMade(true); // Indicate that a query was made

    const fullQuery = `${searchQuery} ${selectedTags.join(' ')}`.trim(); // Combine search query and tags
    console.log(`Searching for: ${fullQuery}`);

    try {
      const response = await fetch('/api/pinecone/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ queryText: fullQuery }),
      });

      if (!response.ok) {
        throw new Error('Failed to query Pinecone.');
      }

      const data = await response.json();
      console.log('Response from Pinecone:', data);

      setResults((prevResults) => [
        ...prevResults,
        { text: fullQuery, isUser: true }, // Add the user's query to the results
        ...data.map((item: any) => ({ ...item, isUser: false })), // Add the response items
      ]);

      setSearchQuery(''); // Clear the search input box
    } catch (error) {
      console.error('Error querying Pinecone:', error);
      setError('Failed to fetch results. Please try again.');
    } finally {
      setLoading(false); // Set loading to false
    }
  };

  const handleTagClick = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]); // Add tag to selectedTags
    }
  };

  const handleTagRemove = (tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag)); // Remove tag from selectedTags
  };

  return (
    <main className="flex flex-col items-center text-center px-4 pt-20">
      {/* Animated Heading */}
      <header
        className={`transform transition-all duration-700 ease-out ${animateHeading ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          } flex flex-col items-center text-center`}
      >
        <h2 className="text-3xl md:text-5xl font-bold mb-3">
          Discover Historical Archives
        </h2>
        <p className="text-base md:text-lg text-gray-400 max-w-md mx-auto">
          Explore South Africa's constitutional history through curated archives.
        </p>
      </header>

      {/* Chat Log Section */}
      {results.length > 0 && (
        <section className="custom-scrollbar mt-10 w-full max-w-6xl h-96 overflow-y-auto bg-gray-900 p-4 rounded-md">
          {results.map((result, index) => (
            <div
              key={index}
              className={`mb-4 p-4 rounded-3xl ${result.isUser
                  ? 'bg-blue-600 text-white self-end text-right ml-auto w-fit'
                  : 'bg-gray-800 text-white self-start text-left w-fit'
                }`}
            >
              <p className="text-lg">{result.isUser ? result.text : result.answer}</p>
              {/* sasUrls is a vector, print all available links next to each other*/}
              {!result.isUser && result.sasUrls && result.sasUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {result.sasUrls.map((url: string, idx: number) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      View File {idx + 1}
                    </a>
                  ))}
                </div>
              )}
              {/* If the result is not from the user and has a sasUrl, show it */}

            </div>
          ))}
        </section>
      )}

      {/* Search Form */}
      <form
        onSubmit={handleSearch}
        className=" mt-10 flex flex-row items-center gap-2 justify-center mb-12 w-full max-w-lg"
      >
        <div className="flex flex-grow items-center gap-2 bg-gray-800 p-3 rounded-md border border-gray-700">
          {selectedTags.map((tag, index) => (
            <div
              key={index}
              className="flex items-center bg-blue-600 text-white px-3 py-1 rounded-full text-sm"
            >
              {tag}
              <button
                type="button"
                className="ml-2 text-white hover:text-gray-300"
                onClick={() => handleTagRemove(tag)}
              >
                &times;
              </button>
            </div>
          ))}
          <input
            type="text"
            name="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for documents, cases, or events..."
            className="flex-grow bg-transparent text-white focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M16.5 10.5a6 6 0 11-12 0 6 6 0 0112 0z"
            />
          </svg>
        </button>
      </form>

      {/* Popular Tags Section */}
      <section
        className={`flex flex-wrap gap-4 justify-center max-w-2xl transition-all duration-700 ease-out ${animateTags ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}
      >
        {['Children Rights', 'Health Care Laws', 'Laws for Education', 'Truth and Reconciliation Commission', 'Freedom Charter'].map((tag) => (
          <button
            key={tag}
            className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-500 hover:text-white transition-colors"
            onClick={() => handleTagClick(tag)}
          >
            {tag}
          </button>
        ))}
      </section>


    </main>
  );
};

export default HomePage;
