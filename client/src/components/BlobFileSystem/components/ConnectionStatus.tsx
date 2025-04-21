import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ConnectionStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // Store error message

  useEffect(() => {
    let isMounted = true;

    const checkConnection = async () => {
      if (!isMounted) return;
      setChecking(true);
      setErrorMessage(null); // Clear previous error
      try {
        // Use a longer timeout for the initial check maybe?
        await axios.get('/api/blob/test-connection', { timeout: 5000 }); 
        if (isMounted) setIsOnline(true);
      } catch (error) {
        if (isMounted) {
          setIsOnline(false);
          // Provide more context in the error message
          if (axios.isAxiosError(error)) {
             if (error.code === 'ECONNREFUSED') {
                setErrorMessage('Connection Refused: Cannot reach backend server.');
             } else if (error.response) {
                setErrorMessage(`Server Error: ${error.response.status}`);
             } else {
                setErrorMessage(`Network Error: ${error.message}`);
             }
          } else {
             setErrorMessage(`Error: ${error.message}`);
          }
          console.error("Connection check failed:", error.message);
        }
      } finally {
        if (isMounted) setChecking(false);
      }
    };

    checkConnection(); 
    const interval = setInterval(checkConnection, 60000); 
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);
  
  let statusMessage = 'Checking connection...';
  let statusClass = 'checking';

  if (!checking) {
    if (isOnline) {
      statusMessage = '✅ Server Connected';
      statusClass = 'online';
      // Optionally hide the status when online after a few seconds
      // setTimeout(() => { /* logic to hide */ }, 3000);
    } else {
      // Display the specific error message
      statusMessage = `⚠️ Connection Failed: ${errorMessage || 'Unknown error'}`;
      statusClass = 'offline error'; // Add error class
    }
  }

  // Make the status more prominent, especially on error
  return (
    <div className={`connection-status ${statusClass}`}>
      {statusMessage}
    </div>
  );
};

export default ConnectionStatus;
