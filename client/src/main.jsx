import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { checkServerConnection, showServerStatusMessage } from './utils/serverCheck';

// Check server connection when the app starts
checkServerConnection().then(isConnected => {
  if (!isConnected) {
    showServerStatusMessage();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
