import React, { useState, useEffect } from 'react';

const HomePage = () => {
  const [results, setResults] = useState<any[]>([]); // State to store search results
  const [error, setError] = useState<string | null>(null); // State to store errors
  const [typedResults, setTypedResults] = useState<string[]>([]); // State for typing effect
  const [loading, setLoading] = useState<boolean>(false); // State to track loading status
  const [loadingText, setLoadingText] = useState<string>('Generating'); // State for animated loading text

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const searchQuery = form.search.value.trim();
    if (!searchQuery) {
      console.error('Search query cannot be empty.');
      setError('Search query cannot be empty.');
      return;
    }
    setError(null); // Clear previous errors
    setLoading(true); // Set loading to true
    console.log(`Searching for: ${searchQuery}`);
    try {
      const response = await fetch('/api/pinecone/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ queryText: searchQuery }),
      });
      if (!response.ok) {
        throw new Error('Failed to query Pinecone.');
      }
      const data = await response.json();
      console.log('Response from Pinecone:', data);
      setResults(data); // Update results state with the response
      setTypedResults([]); // Reset typed results for the typing effect
    } catch (error) {
      console.error('Error querying Pinecone:', error);
      setError('Failed to fetch results. Please try again.');
    } finally {
      setLoading(false); // Set loading to false
    }
  };

  // Effect for animated "Generating..." text
  useEffect(() => {
    if (loading) {
      let dotCount = 0;
      const interval = setInterval(() => {
        dotCount = (dotCount + 1) % 4; // Cycle through 0, 1, 2, 3
        setLoadingText(`Generating${'.'.repeat(dotCount)}`); // Update loading text
      }, 200); // Adjust speed of animation here

      return () => clearInterval(interval); // Cleanup interval on unmount or when loading stops
    }
  }, [loading]);

  useEffect(() => {
    if (results.length > 0) {
      let currentIndex = 0;
      const typeNextResult = () => {
        if (currentIndex < results.length) {
          const currentResult = results[currentIndex];
          let currentText = '';
          let charIndex = 0;

          const typeCharacter = () => {
            if (charIndex < currentResult.text.length) {
              currentText += currentResult.text[charIndex];
              setTypedResults((prev) => {
                const updated = [...prev];
                updated[currentIndex] = currentText;
                return updated;
              });
              charIndex++;
              setTimeout(typeCharacter, 20); // Adjust typing speed here
            } else {
              currentIndex++;
              setTimeout(typeNextResult, 500); // Delay before typing the next result
            }
          };

          typeCharacter();
        }
      };

      typeNextResult();
    }
  }, [results]);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        alignItems: "center",
        padding: "2rem",
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      {/* Centered Search Bar */}
      <section
        style={{
          width: "100%",
          maxWidth: "600px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem", width: "100%" }}>
          <input
            type="text"
            name="search"
            placeholder="Search for something..."
            style={{
              padding: "0.5rem",
              flex: 1,
              border: "1px solid #ccc",
              borderRadius: "5px",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#007bff", // Set background to blue
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </form>
      </section>

      {/* Display Results */}
      <section
        style={{
          width: "100%",
          maxWidth: "600px",
          marginTop: "1rem",
          textAlign: "left",
          padding: "1rem",
        }}
      >
        {loading && <p>{loadingText}</p>} {/* Show animated "Generating..." while loading */}
        {error && <p style={{ color: "red" }}>{error}</p>}
        {!loading && typedResults.length > 0 && (
          <div>
            <ul>
              {typedResults.map((typedText, index) => (
                <li key={index} style={{ marginBottom: "1rem" }}>
                  <p>{typedText}</p>
                  <a
                    href={results[index]?.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#007bff", textDecoration: "underline" }}
                  >
                    Open File
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!loading && !error && results.length === 0 && <p>No results found. Try another query.</p>}
      </section>
    </main>
  );
};

export default HomePage;
