import { SignedOut, SignInButton, SignedIn, UserButton } from "@clerk/clerk-react";

export default function AdminPage() {
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
      <header style={{ position: "absolute", top: "1rem", right: "1rem", fontSize: "1.25rem" }}>
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>
      <h1>Welcome, Admin!</h1>
      <p>This is the admin dashboard.</p>
    </main>
  );
}
