import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react';

const RootLayout = () => {
  const { isSignedIn } = useAuth();
  const location = useLocation();

  let navLinkText = "goHome";
  let navLinkPath = "/";

  if (isSignedIn) {
    if (location.pathname === '/admin') {
      navLinkText = "goHome";
      navLinkPath = "/";
    } else {
      navLinkText = "goAdmin";
      navLinkPath = "/admin";
    }
  }

  return (
    <main className="flex flex-col min-h-screen bg-gray-900 text-gray-200 font-sans">
      
      {/* Header */}
      <header className="bg-gray-900 shadow-md border-b-2 border-gray-700">
        <section className="container mx-auto flex justify-between items-center px-4 py-3">
          
          {/* Left side - Archive Title */}
          <h1 className="text-xl font-bold">
            <Link to="/" className="text-white hover:text-blue-400">
              Archive
            </Link>
          </h1>

          {/* Right side - goAdmin/goHome + Profile Icon */}
          <nav className="flex items-center gap-6">
            <Link
              to={navLinkPath}
              className="text-gray-300 hover:text-blue-400 text-center min-w-16"
            >
              {navLinkText}
            </Link>

            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton />
            </SignedOut>
          </nav>

        </section>
      </header>

      {/* Main Content */}
      <section className="flex-grow container mx-auto px-4 py-6">
        <Outlet />
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 mt-auto">
        <section className="container mx-auto px-4 py-4 text-center">
          <p>© {new Date().getFullYear()} Archive. All rights reserved.</p>
        </section>
      </footer>
    </main>
  );
};

export default RootLayout;

