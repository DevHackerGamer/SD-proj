import React from 'react';
import { SignedOut, SignedIn, UserButton, SignInButton } from '@clerk/clerk-react';

const HomePage = () => {
  // No redirect useEffect needed here

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const searchQuery = form.search.value.trim();
    if (!searchQuery) {
      console.error('Search query cannot be empty.');
      return;
    }
    console.log(`Searching for: ${searchQuery}`);
    // Add your search logic here
  };

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      <header
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          fontSize: "1.25rem",
        }}
      >
    
      </header>

      {/* Centered Search Bar */}
      <section
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            name="search"
            placeholder="Search for something..."
            style={{
              padding: "0.5rem",
              width: "300px",
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
    </main>
  );
};

export default HomePage;
