import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react';

const RootLayout = () => {
  console.log('RootLayout rendering');
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
    <div className="root-layout flex flex-col min-h-screen bg-gray-900 text-gray-200">
      <header className="main-header bg-gray-900 shadow-md border-b-2 border-gray-700">
        <div className="container mx-auto px-4 py-3 flex items-center">
          {/* Left side: site title */}
          <Link to="/" className="site-title text-xl font-bold text-white hover:text-blue-400">
            Archive
          </Link>

          {/* Center: nav links */}
          <nav className="main-navigation flex items-center space-x-4 ml-6">
            <Link
              to={navLinkPath}
              className="text-gray-300 hover:text-blue-400 min-w-16 text-center"
            >
              {navLinkText}
            </Link>
          </nav>

          {/* Right side: auth buttons */}
          <div className="ml-auto flex items-center space-x-2">
            <SignedOut>
              <SignInButton />
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="main-content flex-grow">
        <div className="container mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      <footer className="main-footer bg-gray-800 text-gray-300 mt-auto">
        <div className="container mx-auto px-4 py-4 text-center">
          <p>© {new Date().getFullYear()} Archive. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default RootLayout;
