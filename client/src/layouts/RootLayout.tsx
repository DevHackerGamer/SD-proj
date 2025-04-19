import React from 'react'; // Removed useEffect if it was added previously
import { Outlet, Link, useLocation } from 'react-router-dom'; // Removed useNavigate if added previously
import { useAuth } from '@clerk/clerk-react'; // Removed useSession if added previously

const RootLayout = () => {
  console.log('RootLayout rendering');
  const { isSignedIn } = useAuth();
  const location = useLocation();
  // Removed navigate hook if added previously
  // Removed redirect useEffect if added previously

  // Determine link text and path based on sign-in status and current location (Keep this logic)
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
        <div className="container mx-auto px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/" className="site-title text-xl font-bold text-white hover:text-blue-400">Archive</Link>
          <nav className="main-navigation flex items-center space-x-4">
            <Link
              to={navLinkPath}
              className="text-gray-300 hover:text-blue-400 min-w-16 text-center"
            >
              {navLinkText}
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content flex-grow">
        <div className="container mx-auto px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="main-footer bg-gray-800 text-gray-300 mt-auto">
        <div className="container mx-auto px-4 py-4 text-center">
          <p>© {new Date().getFullYear()} Archive. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default RootLayout;
