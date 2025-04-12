import React, { useState } from 'react';
import './MyLayout.css';
import { SignedOut, SignInButton, SignedIn, UserButton } from "@clerk/clerk-react";

export default function MyLayout() {
  // Manage which pane is minimized: 'A', 'B', or none (null)

  const [minimizedPane, setMinimizedPane] = useState<"A" | "B" | null>(null);

  const toggleMinimizeA = () => {
    setMinimizedPane(minimizedPane === 'A' ? null : 'A');
  };

  const toggleMinimizeB = () => {
    setMinimizedPane(minimizedPane === 'B' ? null : 'B');
  };

  return (
    <>
      {/* Header bar (A) */}
      <header className="header-bar">
        <nav>
          <SignedOut>
            <SignInButton />
          </SignedOut>
          <SignedIn>
            <UserButton />
            <p>Hello Admin</p>
          </SignedIn>

        </nav>
      </header>

      {/* Main Content Area */}
      <main className="layout-main">
      {minimizedPane === "B" ? (
        <article className="pane maximized">
          <header className="docked-header">
            <h3>Pane B (Docked)</h3>
            <button onClick={toggleMinimizeB}>Restore B</button>
          </header>
          <section className="pane-content">
            <header className="pane-header">
              <h2>Pane A</h2>
              <button onClick={toggleMinimizeA}>Minimize A</button>
            </header>
            <p>Content for Pane A goes here.</p>
          </section>
        </article>
      ) : minimizedPane === "A" ? (
        <article className="pane maximized">
          <section className="pane-content">
            <header className="pane-header">
              <h2>Pane B</h2>
              <button onClick={toggleMinimizeB}>Minimize B</button>
            </header>
            <p>Content for Pane B goes here.</p>
          </section>
          <footer className="docked-footer">
            <h3>Pane A (Docked)</h3>
            <button onClick={toggleMinimizeA}>Restore A</button>
          </footer>
        </article>
      ) : (
        <>
          <article className="pane pane-a">
            <header className="pane-header">
              <h2>Pane A</h2>
              <button onClick={toggleMinimizeA}>Minimize A</button>
            </header>
            <section className="pane-content">
              <p>Content for Pane A goes here.</p>
            </section>
          </article>
          <article className="pane pane-b">
            <header className="pane-header">
              <h2>Pane B</h2>
              <button onClick={toggleMinimizeB}>Minimize B</button>
            </header>
            <section className="pane-content">
              <p>Content for Pane B goes here.</p>
            </section>
          </article>
        </>
      )}
    </main>
    </>
  );
}
