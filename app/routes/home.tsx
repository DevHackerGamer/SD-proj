import { useEffect, useState } from "react";
import { useUser, ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Home() {
    const { user } = useUser();
    const navigate = useNavigate();

    const [searchResult, setSearchResult] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>("")
    const [result, setResult] = useState("");    

    useEffect(() => {
        // Check if the user is signed in
        if (user) {
            // Navigate to the /admin page if the user is signed in
            navigate("/admin");
        }
    }, [user, navigate]); // Re-run when user changes

    const handleSearch = async(e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const searchQuery = (e.target as HTMLFormElement).search.value;
    console.log("Searching for:", searchQuery);

    try {
        const res = await fetch("http://localhost:5000/api/query", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: searchQuery }),
        });

        const data = await res.json();
        console.log("Response from server:", data);
        setResult(data.answer || "No answer found.");
    } catch (err) {
        console.error("Error during fetch:", err);
        setResult("An error occurred.");
    }
    };

    return (
        <main style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
            {/* Top-right Login Button */}
            <header style={{ position: "absolute", top: "1rem", right: "1rem", fontSize: "1.25rem" }}>
                <SignedOut>
                    <SignInButton />
                </SignedOut>
                <SignedIn>
                    <UserButton />
                </SignedIn>
            </header>

            {/* Centered Search Bar */}
            <section
                style={{
                    flex: 1,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    flexDirection:"column",
                }}
            >
                <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                        type="text"
                        name="search"
                        placeholder="Search for something..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
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
                            backgroundColor: "#28A745",
                            color: "white",
                            border: "none",
                            borderRadius: "5px",
                            cursor: "pointer",
                        }}
                    >
                        Search
                    </button>
                </form>
                    {/* Display Search Result */}
                    {result && (
                        <section style={{ marginTop: "1rem", textAlign: "center" }}>
                            <p><strong>Answer:</strong> {result}</p>
                        </section>
)}

            </section>
        </main>
    );
}