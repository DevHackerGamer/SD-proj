import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/clerk-react';
import { SlArrowLeftCircle,SlArrowRightCircle   } from "react-icons/sl";
// At the top of your file
import logo from './logo.png'; // Adjust if your path differs



const RootLayout = () => {
  const { isSignedIn } = useAuth();
  const location = useLocation();

  let navLinkText = "goHome";
  let navLinkPath = "/";

  if (isSignedIn) {
    if (location.pathname === '/admin') {
      navLinkText = "";
      navLinkPath = "/";
    } else {
      navLinkText = "";
      navLinkPath = "/admin";
    }
  }

  return (
    <main className="flex flex-col min-h-screen bg-gray-900 text-gray-200 font-sans">
      
      {/* Header */}
      <header className="bg-gray-900 shadow-md border-b-2 border-gray-700">
        <section className="container mx-auto flex justify-between items-center px-4 py-3">

{/* Left side - Logo and Archive Title */}
<h1 className="text-2xl font-bold font-title">
  <Link to="/" className="flex items-center text-white hover:text-blue-400 gap-3">
    <img src={logo} alt="Logo" className="h-14 w-auto logo-glow" />
    Archive
  </Link>
</h1>


          
          {/* Right side - goAdmin/goHome + Profile Icon */}
          <nav className="flex items-center gap-6">
            <SignedIn>
              <Link
                to={navLinkPath}
                className="text-gray-300 hover:text-blue-400 text-center text-2xl"
              >
                {location.pathname === '/admin' ? <SlArrowLeftCircle /> : <SlArrowRightCircle />}
              </Link>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton>
                <button 
                className="text-gray-300 hover:text-blue-400 px-4 py-2 rounded transition-transform">
                  Sign In
                </button>
              </SignInButton>
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

