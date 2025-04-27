import React, { useState, useEffect } from 'react';

const HomePage = () => {
  const [loading, setLoading] = useState(false);
  const [animateHeading, setAnimateHeading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimateHeading(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const searchQuery = form.search.value.trim();
    if (!searchQuery) {
      console.error('Search query cannot be empty.');
      return;
    }
    console.log(`Searching for: ${searchQuery}`);
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      console.log('Search completed.');
    }, 2000);
  };

  return (
    <main className="flex flex-col items-center text-center px-4 pt-20">
      
      {/* Animated Heading */}
      <header
        className={`transform transition-all duration-700 ease-out ${
          animateHeading ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <h2 className="text-3xl md:text-5xl font-bold mb-3">
          Discover Historical Archives
        </h2>
        <p className="text-base md:text-lg text-gray-400 mb-8 max-w-md">
          Explore South Africa's constitutional history through curated archives.
        </p>
      </header>

      {/* Search Form */}
      <form
        onSubmit={handleSearch}
        className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-center mb-12 w-full max-w-lg"
      >
        <input
          type="text"
          name="search"
          placeholder="Search for documents, cases, or events..."
          className="p-3 w-full sm:w-72 bg-gray-800 text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          className="p-3 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? (
            <section className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              <strong>Loading...</strong>
            </section>
          ) : (
            <strong>Search</strong>
          )}
        </button>
      </form>

      {/* Popular Tags Section */}
      <section className="flex flex-wrap gap-4 justify-center max-w-2xl">
        <button className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-500 hover:text-white transition-colors">
          1996 Constitution
        </button>
        <button className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-500 hover:text-white transition-colors">
          Bill of Rights
        </button>
        <button className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-500 hover:text-white transition-colors">
          Apartheid Laws
        </button>
        <button className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-500 hover:text-white transition-colors">
          Truth and Reconciliation Commission
        </button>
        <button className="px-4 py-2 border border-blue-500 text-blue-500 rounded-md hover:bg-blue-500 hover:text-white transition-colors">
          Freedom Charter
        </button>
      </section>

    </main>
  );
};

export default HomePage;
