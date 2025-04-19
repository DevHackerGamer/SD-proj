import React, { useEffect, useState } from 'react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useAuth,
  useClerk,
} from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
// Just ignore the type checking for path-browserify since we only need extname
// @ts-ignore
import path from 'path-browserify';

const AdminPage = () => {
  const { isSignedIn, sessionId } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!isSignedIn || !sessionId) {
      navigate('/');
    }
  }, [isSignedIn, sessionId, navigate]);

  const onDrop = (acceptedFiles: File[]) => {
    if (Array.isArray(acceptedFiles) && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setStatus('');
    } else {
      setStatus('Invalid file selection. Please try again.');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  const handleUpload = async () => {
    if (!file) {
      setStatus('Please select a file to upload!');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setStatus('Uploading, please wait...');

    try {
      const response = await fetch('http://your-backend-domain/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json();
        setStatus(`File upload successful: ${data.fileName}`);
        // Use a try/catch to safely extract the extension
        let ext = '';
        try {
          ext = path.extname(data.fileName).slice(1).toUpperCase();
        } catch (err) {
          console.error('Error getting file extension:', err);
          ext = 'FILE';
        }
        window.alert(`${ext} ${data.fileName} was uploaded successfully`);
      } else {
        const data = await response.json();
        setStatus(`Error uploading file: ${data.error}`);
      }
    } catch (error) {
      setStatus(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
      }}
    >
      <header
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          fontSize: '1.25rem',
        }}
      >
        <SignedOut>
          <SignInButton />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>

      <h1>Welcome, Admin!</h1>
      <p>This is the admin dashboard. Only accessible if you're logged in.</p>

      <section
        {...getRootProps()}
        style={{
          border: '3px dashed #4CAF50',
          borderRadius: '8px',
          padding: '20px',
          marginTop: '20px',
          cursor: 'pointer',
          backgroundColor: isDragActive ? '#f0f8ff' : '#fff',
          // Removed transition animation
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <input {...getInputProps()} />
        {file ? (
          <p
            style={{
              textAlign: 'center',
              padding: '20px',
              border: '2px dashed #007BFF',
              borderRadius: '10px',
              backgroundColor: '#e7f7e7',
              color: '#333',
              fontSize: '16px',
              cursor: 'pointer',
              // Removed transition animation
            }}
          >
            <strong>{file.name}</strong> selected. Click to change or drag another file.
          </p>
        ) : isDragActive ? (
          <p
            style={{
              textAlign: 'center',
              padding: '20px',
              border: '2px dashed #007BFF',
              borderRadius: '10px',
              backgroundColor: '#f9f9f9',
              color: '#333',
              fontSize: '16px',
              cursor: 'pointer',
              // Removed transition animation
            }}
          >
            Drag and drop a file here...
          </p>
        ) : (
          <p
            style={{
              textAlign: 'center',
              padding: '20px',
              border: '2px dashed #007BFF',
              borderRadius: '10px',
              backgroundColor: '#f9f9f9',
              color: '#333',
              fontSize: '16px',
              cursor: 'pointer',
              // Removed transition animation
            }}
          >
            Click here to upload files, OR drag files
          </p>
        )}
      </section>

      <button
        onClick={handleUpload}
        style={{
          fontSize: '16px',
          fontWeight: 'bold',
          margin: '8px',
          // Removed text shadow animation
          backgroundColor: '#007bff',
          color: 'white',
          padding: '10px 15px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Upload
      </button>

      <p>{status}</p>
    </main>
  );
};

export default AdminPage;
