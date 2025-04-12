import { useEffect, useState } from "react";
import { useUser, ClerkProvider, SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function Home() {
    const { user } = useUser();
    const navigate = useNavigate();

    useEffect(() => {
        // Check if the user is signed in
        if (user) {
            // Navigate to the /admin page if the user is signed in
            navigate("/admin");
        }
    }, [user, navigate]); // Re-run when user changes

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const searchQuery = (e.target as HTMLFormElement).search.value;
        console.log("Searching for:", searchQuery);
        // Add logic to handle search functionality
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
            </section>
        </main>
    );
}