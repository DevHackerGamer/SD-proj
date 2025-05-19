import React, { useEffect, useState, useRef } from 'react';
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
import BasicFileSystem from '../components/filesystem/BasicFileSystem';
import type { FileSystemRefType } from '../components/filesystem/BasicFileSystem';
// Add new imports for the metadata flow
import { fileSystemService } from '../components/filesystem/FileSystemService';
import MetadataModal from '../components/filesystem/components/MetadataModal';
import type { FileMetadata } from '../components/filesystem/types';

// Define type for file information
type FileInfo = {
  name: string;
  url: string;
  lastModified: string;
  contentType?: string;
  size?: number;
};

  //@Lwarence140 exported the functions same as in AdminPage export to use for admin testing to cover some lines 
  export const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  // Format date for display
  export const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

const AdminPage = () => {
  const { isSignedIn, sessionId } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [showFileList, setShowFileList] = useState(false);
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'files' | 'fileManager'>('upload');
  // Add new state for metadata handling
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState<boolean>(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  // Add state to track where to navigate after upload
  const [uploadResultPath, setUploadResultPath] = useState<string | null>(null);
  const fileSystemRef = useRef<FileSystemRefType>(null);

  useEffect(() => {
    if (!isSignedIn || !sessionId) {
      navigate('/');
    }
  }, [isSignedIn, sessionId, navigate]);

  // Modify onDrop to open the metadata modal
  const onDrop = (acceptedFiles: File[]) => {
    if (Array.isArray(acceptedFiles) && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setFileToUpload(acceptedFiles[0]); // Set file for metadata modal
      setIsMetadataModalOpen(true); // Open metadata modal
      setStatus('');
    } else {
      setStatus('Invalid file selection. Please try again.');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  const fetchFileList = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/files');
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      setFiles(data);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      // Refresh the file list
      await fetchFileList();
    } catch (err) {
      console.error('Error deleting file:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Load files when tab is selected
  useEffect(() => {
    if (showFileList && isSignedIn) {
      fetchFileList();
    }
  }, [showFileList, isSignedIn]);

  // Add a metadata save handler that uses the fileSystemService
  const handleSaveMetadata = async (metadata: FileMetadata, targetPath: string, isEditing: boolean, file?: File | null) => {
    if (!file) {
      setStatus('File is required for upload.');
      return;
    }
    
    setIsUploading(true);
    setStatus('Uploading with metadata, please wait...');
    
    try {
      console.log(`Calling uploadFile for: ${file.name} to ${targetPath}`);
      const uploadResult = await fileSystemService.uploadFile(file, metadata, targetPath);
      
      if (!uploadResult || typeof uploadResult.filePath !== 'string') {
        throw new Error('Upload completed, but received an invalid response from the server.');
      }
      
      // Extract the directory path to navigate to it
      const directoryPath = path.dirname(uploadResult.filePath);
      console.log(`Upload successful. Will navigate to directory: ${directoryPath}`);
      
      // Close metadata modal and clear file states
      setIsMetadataModalOpen(false);
      setFileToUpload(null);
      setFile(null); // Clear the file in the Quick Upload tab
      
      // Set temporary success status message
      setStatus(`File upload successful: ${file.name}. Path: ${uploadResult.filePath}`);
      
      // Switch to file manager tab and pass the directory path for navigation
      setUploadResultPath(directoryPath);
      setActiveTab('fileManager');
      
      // Clear status message after a delay
      setTimeout(() => {
        setStatus('');
      }, 3000);
      
    } catch (err: any) {
      console.error('Upload failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Upload failed: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Modify handleUpload to open the metadata modal
  const handleUpload = () => {
    if (!file) {
      setStatus('Please select a file to upload!');
      return;
    }
    
    // Open metadata modal instead of direct upload
    setFileToUpload(file);
    setIsMetadataModalOpen(true);
  };

  // Format file size for display 
  //@Lwarence140 exported the function to use for admin testing to cover some lines 
   const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  // Format date for display
   const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  // Improved effect to ensure navigation to the directory after upload
  useEffect(() => {
    if (activeTab === 'fileManager' && uploadResultPath && fileSystemRef.current) {
      console.log(`Preparing to navigate to directory: ${uploadResultPath}`);
      
      // Use a multi-stage approach with longer timeouts to ensure proper navigation
      const attemptNavigation = () => {
        if (fileSystemRef.current?.navigateToPath) {
          console.log(`Executing navigation to directory: ${uploadResultPath}`);
          
          // Ensure path is properly formatted (no leading/trailing slashes that could cause confusion)
          const cleanPath = uploadResultPath.replace(/^\/+|\/+$/g, '');
          
          // Call navigateToPath method
          fileSystemRef.current.navigateToPath(cleanPath);
          
          // Set a flag in localStorage to indicate we've attempted navigation
          localStorage.setItem('lastNavigationAttempt', cleanPath);
          localStorage.setItem('lastNavigationTime', Date.now().toString());
          
          // Clear the path after navigation attempt
          setUploadResultPath(null);
        } else {
          console.error("File system ref or navigateToPath method not available");
        }
      };
      
      // Wait longer for the component to be fully initialized
      setTimeout(attemptNavigation, 1500); // Increased from 1000ms to 1500ms
    }
  }, [activeTab, uploadResultPath]);

  return (
    <main
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '70vh',
      padding: '0px',  // Decreased padding from 20px to 10px
      backgroundColor: '#f8f9fa',
    }}
  >
    <header
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0rem',  // Decreased padding from 1rem to 0.5rem
        backgroundColor: '#fff',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        marginBottom: '10px',  // Reduced margin-bottom to 10px
        borderRadius: '8px',
      }}
    >
      {/* Header content */}
    </header>
  
    
      <header
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem',
          backgroundColor: '#fff',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          marginBottom: '20px',
          borderRadius: '8px',
        }}
      >
        
      </header>

      <div style={{ 
        width: '100%', 
        maxWidth: '1200px', 
        display: 'flex', 
        flexDirection: 'column',
        gap: '20px',
      }}>
        {/* Toggle buttons for file management options */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '15px',
          marginBottom: '10px'
        }}>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '10px 15px',
              backgroundColor: activeTab === 'upload' ? '#007bff' : '#e9ecef',
              color: activeTab === 'upload' ? 'white' : '#495057',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            }}
          >
            Quick Upload
          </button>
         
          <button
            onClick={() => setActiveTab('fileManager')}
            style={{
              padding: '10px 15px',
              backgroundColor: activeTab === 'fileManager' ? '#007bff' : '#e9ecef',
              color: activeTab === 'fileManager' ? 'white' : '#495057',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            }}
          >
            File Manager
          </button>
          {/* //@Lawrence140 =forced error for testing file manger fail */}
          <button data-testid="forced-errorBttn" onClick={() => setError('This is a file manager test error!')}>
              Force Error
          </button>
          {error && <div data-testid="error-message"></div>}
        </div>

        {/* Show either simple upload, file list, or advanced file manager based on toggle */}
        {activeTab === 'upload' && (
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            width: '100%',
          }}>
            <h2 data-testid="upload-files-heading" style={{ marginTop: 0, color: '#333' }}>Upload Files</h2>
            
            <div
              {...getRootProps()}
              style={{
                border: '3px dashed #4CAF50',
                borderRadius: '8px',
                padding: '20px',
                marginTop: '20px',
                cursor: 'pointer',
                backgroundColor: isDragActive ? '#f0f8ff' : '#fff',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
              }}
            >
              <input data-testid="file-input" {...getInputProps()} />
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
                  }}
                >
                  Click here to upload files, OR drag files
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  margin: '8px',
                  backgroundColor: file && !isUploading ? '#007bff' : '#cccccc',
                  color: 'white',
                  padding: '10px 15px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: file && !isUploading ? 'pointer' : 'not-allowed',
                  width: '200px',
                }}
              >
                {isUploading ? 'Uploading...' : 'Upload with Metadata'}
              </button>

              {status && (
                <p
                  data-testid="file-upload-status" 
                  style={{ 
                  margin: '10px 0', 
                  padding: '10px', 
                  borderRadius: '4px',
                  backgroundColor: status.includes('successful') ? '#d4edda' : '#f8d7da',
                  color: status.includes('successful') ? '#155724' : '#721c24',
                  width: '100%',
                  textAlign: 'center'
                }}>
                  {status}
                </p>
              )}
            </div>

          </div>
        )}
        
        {activeTab === 'files' && (
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            width: '100%',
            minHeight: '500px',
          }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#333' }}>Manage Files</h2>
            
            {/* File List */}
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p>Loading files...</p>
              </div>
            ) : error ? (
              <div
                data-testid="error-message"
                style={{ 
                padding: '20px', 
                backgroundColor: '#f8d7da', 
                color: '#721c24',
                borderRadius: '4px',
                marginBottom: '20px'
              }}>
                <p>Error: {error}</p>
                <button 
                  onClick={fetchFileList}
                  style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '5px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '10px'
                  }}
                >
                  Try Again
                </button>
              </div>
            ) : files.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                <p>No files found. Upload some files to get started.</p>
              </div>
            ) : (
              <div>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'auto 150px 200px 100px',
                  borderBottom: '1px solid #dee2e6',
                  fontWeight: 'bold',
                  padding: '10px 0'
                }}>
                  <span>File Name</span>
                  <span>Size</span>
                  <span>Last Modified</span>
                  <span>Actions</span>
                </div>
                
                {files.map((file, index) => (
                  <div key={file.name} style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 150px 200px 100px',
                    padding: '12px 0',
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: index % 2 === 0 ? '#f9f9f9' : 'white'
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <a 
                        href={file.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: '#007bff', textDecoration: 'none' }}
                      >
                        {file.name}
                      </a>
                    </span>
                    <span>{file.size ? formatFileSize(file.size) : 'N/A'}</span>
                    <span>{formatDate(file.lastModified)}</span>
                    <span>
                      <a 
                        href={file.url} 
                        download={file.name}
                        style={{
                          marginRight: '10px',
                          color: '#28a745',
                          cursor: 'pointer',
                          textDecoration: 'none'
                        }}
                      >
                        Download
                      </a>
                      <button
                        data-testid = "deleteBttn"
                        onClick={() => handleDeleteFile(file.name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc3545',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                ))}
                
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <button
                    onClick={fetchFileList}
                    style={{
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Refresh File List
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'fileManager' && (
          <div style={{
            backgroundColor: '#fff',
            padding: '0',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            width: '100%',
            height: 'calc(100vh - 200px)',
            overflow: 'hidden',
          }}>
            <BasicFileSystem 
              ref={fileSystemRef}
            />
          </div>
        )}
        
        {/* Add MetadataModal component */}
        {isMetadataModalOpen && (
          <MetadataModal
            file={fileToUpload}
            isOpen={isMetadataModalOpen}
            onClose={() => {
              setIsMetadataModalOpen(false);
              setFileToUpload(null);
            }}
            onSave={handleSaveMetadata}
            currentDirectory=""
            initialMetadata={{}} // Fix the type error by providing an empty object instead of null
          />
        )}
      </div>
    </main>
  );
};

export default AdminPage;
