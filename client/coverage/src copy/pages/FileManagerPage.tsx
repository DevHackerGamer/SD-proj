import React from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
} from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import BlobFileManager from '../components/BlobFileSystem/BlobFileManager';
import './FileManagerPage.css'; // We'll create this file for the styles

const FileManagerPage: React.FC = () => {
  const { isSignedIn, sessionId } = useAuth();
  const navigate = useNavigate();

  // Redirect to home if not signed in
  React.useEffect(() => {
    if (!isSignedIn || !sessionId) {
      navigate('/');
    }
  }, [isSignedIn, sessionId, navigate]);

  return (
    <div className="atom-application">
      <header className="atom-global-header">
        <div className="atom-header-container">
          <div className="atom-logo">
            <h1>AtoM Digital Repository</h1>
          </div>
          <div className="atom-user-controls">
            <SignedOut>
              <SignInButton mode="modal" />
            </SignedOut>
            <SignedIn>
              <div className="atom-user-menu">
                <span className="atom-welcome-text">Welcome, Archivist</span>
                <UserButton />
              </div>
            </SignedIn>
          </div>
        </div>
        
        <nav className="atom-main-navigation">
          <ul>
            <li><a href="#" className="active">Browse</a></li>
            <li><a href="#">Search</a></li>
            <li><a href="#">Import</a></li>
            <li><a href="#">Admin</a></li>
            <li><a href="#">About</a></li>
          </ul>
        </nav>
      </header>

      <main className="atom-main-content">
        <SignedIn>
          <BlobFileManager />
        </SignedIn>
        <SignedOut>
          <div className="atom-auth-required">
            <div className="atom-auth-message">
              <h2>Authentication Required</h2>
              <p>Please sign in to access the archival materials.</p>
              <div className="atom-signin-button">
                <SignInButton mode="modal" />
              </div>
            </div>
          </div>
        </SignedOut>
      </main>
      
      <footer className="atom-footer">
        <div className="atom-footer-content">
          <p>© 2023 Digital Archives - Access to Memory System</p>
          <p>
            <a href="#">Terms of Use</a> | 
            <a href="#">Privacy Policy</a> | 
            <a href="#">Accessibility</a> | 
            <a href="#">Contact</a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default FileManagerPage;
