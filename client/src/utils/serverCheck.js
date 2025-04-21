/**
 * Utility to check if the server is running
 */
import axios from 'axios';

export const checkServerConnection = async (url = 'http://localhost:3000/api/blob/test-connection') => {
  try {
    const response = await axios.get(url, { timeout: 5000 });
    if (response.status === 200) {
      console.log('✅ Server is running and responding!');
      return true;
    }
    console.error('❌ Server responded with an unexpected status:', response.status);
    return false;
  } catch (error) {
    console.error('❌ Cannot connect to server:', error.message);
    return false;
  }
};

export const showServerStatusMessage = () => {
  const messageElement = document.createElement('div');
  messageElement.style.position = 'fixed';
  messageElement.style.bottom = '20px';
  messageElement.style.right = '20px';
  messageElement.style.padding = '10px 20px';
  messageElement.style.backgroundColor = '#f44336';
  messageElement.style.color = 'white';
  messageElement.style.borderRadius = '4px';
  messageElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  messageElement.style.zIndex = '9999';
  messageElement.innerHTML = 'Cannot connect to the server. Please make sure the server is running.';
  
  document.body.appendChild(messageElement);
  
  setTimeout(() => {
    messageElement.style.opacity = '0';
    messageElement.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      document.body.removeChild(messageElement);
    }, 500);
  }, 5000);
};
