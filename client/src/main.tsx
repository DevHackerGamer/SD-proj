import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
// Import Clerk components for route protection
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'; 
// Import useNavigate
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import AdminPage from './pages/AdminPage';
import HomePage from './pages/HomePage';
import TestPage from './pages/TestPage';

console.log("Application initializing..."); // Simplified log

const rootElement = document.getElementById('root');
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
console.log("Clerk Publishable Key:", clerkPubKey ? "Loaded" : "NOT FOUND");

// Create a main App component to handle navigation context
function App() {
  const navigate = useNavigate(); // Keep useNavigate hook for potential future use if needed elsewhere

  if (!clerkPubKey) {
    console.error("Clerk Publishable Key not found inside App component.");
    // Optionally render an error message
    return <div>Configuration Error: Clerk Key Missing.</div>;
  }

  return (
    <ClerkProvider
      publishableKey={clerkPubKey!} // Added non-null assertion for clarity
      // Keep afterSignInUrl as it's the intended prop for this behavior
      afterSignInUrl="/admin"
      afterSignOutUrl="/"
    >
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<HomePage />} /> {/* Consider removing duplicate */}
          {/* Protect the /admin route */}
          <Route 
            path="/admin" 
            element={
              <> {/* Use a fragment to return one element */}
                <SignedIn>
                  <AdminPage />
                </SignedIn>
                <SignedOut>
                  {/* Redirect non-signed-in users to sign-in */}
                  {/* afterSignInUrl in ClerkProvider handles redirect back */}
                  <RedirectToSignIn /> 
                </SignedOut>
              </>
            } 
          />
          <Route path="/test" element={<TestPage />} />
        </Route>
      </Routes>
    </ClerkProvider>
  );
}

// Remove the old ClerkProviderWithRoutes component
/*
function ClerkProviderWithRoutes() {
  // ... old code ...
}
*/

if (!clerkPubKey) {
  console.error("Clerk Publishable Key not found. Check your .env file.");
  // Optionally render an error message to the user
} else if (!rootElement) {
  console.error("Root element #root not found in index.html.");
  // Optionally render an error message to the user
} else {
  try {
    console.log("Attempting to render application...");
    ReactDOM.createRoot(rootElement).render(
      <BrowserRouter>
        {/* Render the new App component */}
        <App />
      </BrowserRouter>
    );
    console.log("Application render call complete!");
  } catch (error) {
    console.error("Fatal error during application initialization:", error);
    // Optionally render an error message to the user
    rootElement.innerHTML = 'Failed to load application. Check console for details.';
  }
}
