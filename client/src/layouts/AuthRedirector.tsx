import React, { useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthRedirectorProps {
  children: React.ReactNode;
}

const AuthRedirector: React.FC<AuthRedirectorProps> = ({ children }) => {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Redirect to /admin only if signed in AND currently at the root path '/'
    if (isSignedIn && location.pathname === '/') {
      navigate('/admin', { replace: true }); // Use replace to avoid back button issues
    }
    // No action needed if not signed in or not at the root path
  }, [isSignedIn, navigate, location.pathname]);

  // Render the child routes while the effect runs
  return <>{children}</>;
};

export default AuthRedirector;
