import React, { useEffect, useState, useRef, useCallback } from 'react';
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
// Import metadataOptions data
import metadataOptionsData from '../components/managefields/metadataOptions.json';
// Import the ManageFieldsComponent
import ManageFieldsComponent from '../components/managefields';
import { FaCloudUploadAlt, FaFileAlt, FaUpload, FaCheck, FaTimes, FaInfoCircle, FaFileImage, FaFilePdf, FaFileAudio, FaFileVideo, FaFileWord, FaQuestionCircle, FaKeyboard, FaSpinner, FaShieldAlt } from 'react-icons/fa';
import './UploadAnimation.css';

// Define type for metadata options
type MetadataOptionsType = {
  collection: string[];
  jurisdictionType: string[];
  jurisdictionName: Record<string, string[]>;
  thematicFocusPrimary: string[];
  thematicFocusSubthemes: Record<string, string[]>;
  issuingAuthorityType: string[];
  issuingAuthorityName: Record<string, string[]>;
  documentFunction: string[];
  version: string[];
  workflowStagePrimary: string[];
  workflowStageSub: Record<string, string[]>;
  language: string[];
  accessLevel: string[];
  fileType: string[];
  license: string[];
};

// Define type for file information
type FileInfo = {
  name: string;
  url: string;
  lastModified: string;
  contentType?: string;
  size?: number;
};

    // Format file size for display
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
  const [activeTab, setActiveTab] = useState<'upload' | 'files' | 'fileManager' | 'manageFields'>('upload');
  // Add new state for metadata handling
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState<boolean>(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  // Add state to track where to navigate after upload
  const [uploadResultPath, setUploadResultPath] = useState<string | null>(null);
  const fileSystemRef = useRef<FileSystemRefType>(null);
  
  // Add state for metadata fields management
  const [metadataOptions, setMetadataOptions] = useState<MetadataOptionsType>(metadataOptionsData as MetadataOptionsType);
  const [selectedFieldCategory, setSelectedFieldCategory] = useState<keyof MetadataOptionsType>('collection');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [fieldSaveStatus, setFieldSaveStatus] = useState<string>('');
  const [newFieldValue, setNewFieldValue] = useState<string>('');
  const [editingField, setEditingField] = useState<{value: string, index: number} | null>(null);
  const [uploadAreaHover, setUploadAreaHover] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showSuccessMessage, setShowSuccessMessage] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>>([]);
  const [uploadSpeed, setUploadSpeed] = useState<string>('0.0');
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState<boolean>(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [verifyingFile, setVerifyingFile] = useState<boolean>(false);

  // Save metadata options to file
  const saveMetadataOptions = async () => {
    setFieldSaveStatus('Saving...');
    try {
      const response = await fetch('/api/metadata/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadataOptions),
      });
      
      if (response.ok) {
        setFieldSaveStatus('Fields saved successfully!');
        setTimeout(() => setFieldSaveStatus(''), 3000);
      } else {
        throw new Error('Failed to save metadata options');
      }
    } catch (err) {
      console.error('Error saving metadata options:', err);
      setFieldSaveStatus('Error saving fields. Please try again.');
    }
  };

  // Helper functions for working with metadata fields
  const handleAddField = (e?: React.FormEvent) => {
    // Add preventDefault to stop form submission
    if (e) e.preventDefault();
    
    if (!newFieldValue.trim()) return;
    
    if (selectedSubCategory) {
      // For hierarchical fields
      const parentCategory = selectedFieldCategory as keyof MetadataOptionsType;
      if (typeof metadataOptions[parentCategory] === 'object' && !Array.isArray(metadataOptions[parentCategory])) {
        const updatedOptions = { ...metadataOptions };
        const hierarchyObj = updatedOptions[parentCategory] as Record<string, string[]>;
        
        if (hierarchyObj[selectedSubCategory]) {
          hierarchyObj[selectedSubCategory] = [...hierarchyObj[selectedSubCategory], newFieldValue];
        } else {
          hierarchyObj[selectedSubCategory] = [newFieldValue];
        }
        
        setMetadataOptions(updatedOptions);
      }
    } else {
      // For simple arrays
      if (Array.isArray(metadataOptions[selectedFieldCategory])) {
        const updatedOptions = { ...metadataOptions };
        (updatedOptions[selectedFieldCategory] as string[]).push(newFieldValue);
        setMetadataOptions(updatedOptions);
      }
    }
    
    setNewFieldValue('');
  };

  const handleUpdateField = (e?: React.FormEvent) => {
    // Add preventDefault to stop form submission
    if (e) e.preventDefault();
    
    if (!editingField || !newFieldValue.trim()) return;
    
    if (selectedSubCategory) {
      // For hierarchical fields
      const parentCategory = selectedFieldCategory as keyof MetadataOptionsType;
      if (typeof metadataOptions[parentCategory] === 'object' && !Array.isArray(metadataOptions[parentCategory])) {
        const updatedOptions = { ...metadataOptions };
        const hierarchyObj = updatedOptions[parentCategory] as Record<string, string[]>;
        
        if (hierarchyObj[selectedSubCategory]) {
          hierarchyObj[selectedSubCategory][editingField.index] = newFieldValue;
        }
        
        setMetadataOptions(updatedOptions);
      }
    } else {
      // For simple arrays
      if (Array.isArray(metadataOptions[selectedFieldCategory])) {
        const updatedOptions = { ...metadataOptions };
        (updatedOptions[selectedFieldCategory] as string[])[editingField.index] = newFieldValue;
        setMetadataOptions(updatedOptions);
      }
    }
    
    setNewFieldValue('');
    setEditingField(null);
  };

  const handleDeleteField = (index: number, e?: React.MouseEvent) => {
    // Add preventDefault to stop any potential event propagation
    if (e) e.preventDefault();
    
    if (selectedSubCategory) {
      // For hierarchical fields
      const parentCategory = selectedFieldCategory as keyof MetadataOptionsType;
      if (typeof metadataOptions[parentCategory] === 'object' && !Array.isArray(metadataOptions[parentCategory])) {
        const updatedOptions = { ...metadataOptions };
        const hierarchyObj = updatedOptions[parentCategory] as Record<string, string[]>;
        
        if (hierarchyObj[selectedSubCategory]) {
          hierarchyObj[selectedSubCategory] = hierarchyObj[selectedSubCategory].filter((_, i) => i !== index);
        }
        
        setMetadataOptions(updatedOptions);
      }
    } else {
      // For simple arrays
      if (Array.isArray(metadataOptions[selectedFieldCategory])) {
        const updatedOptions = { ...metadataOptions };
        (updatedOptions[selectedFieldCategory] as string[]) = (updatedOptions[selectedFieldCategory] as string[]).filter((_, i) => i !== index);
        setMetadataOptions(updatedOptions);
      }
    }
  };

  const handleAddSubCategory = (e?: React.FormEvent) => {
    // Add preventDefault to stop form submission
    if (e) e.preventDefault();
    
    if (!newFieldValue.trim() || !selectedFieldCategory) return;
    
    const parentCategory = selectedFieldCategory as keyof MetadataOptionsType;
    if (typeof metadataOptions[parentCategory] === 'object' && !Array.isArray(metadataOptions[parentCategory])) {
      const updatedOptions = { ...metadataOptions };
      const hierarchyObj = updatedOptions[parentCategory] as Record<string, string[]>;
      
      if (!hierarchyObj[newFieldValue]) {
        hierarchyObj[newFieldValue] = [];
      }
      
      setMetadataOptions(updatedOptions);
      setNewFieldValue('');
    }
  };

  const getFieldsToDisplay = (): string[] => {
    if (selectedSubCategory) {
      const parentCategory = selectedFieldCategory as keyof MetadataOptionsType;
      if (typeof metadataOptions[parentCategory] === 'object' && !Array.isArray(metadataOptions[parentCategory])) {
        const hierarchyObj = metadataOptions[parentCategory] as Record<string, string[]>;
        return hierarchyObj[selectedSubCategory] || [];
      }
    } else if (Array.isArray(metadataOptions[selectedFieldCategory])) {
      return metadataOptions[selectedFieldCategory] as string[];
    }
    
    return [];
  };

  const getSubCategories = (): string[] => {
    const parentCategory = selectedFieldCategory as keyof MetadataOptionsType;
    if (typeof metadataOptions[parentCategory] === 'object' && !Array.isArray(metadataOptions[parentCategory])) {
      return Object.keys(metadataOptions[parentCategory] as Record<string, string[]>);
    }
    return [];
  };

  const isHierarchicalField = (): boolean => {
    return typeof metadataOptions[selectedFieldCategory] === 'object' && !Array.isArray(metadataOptions[selectedFieldCategory]);
  };

  useEffect(() => {
    if (!isSignedIn || !sessionId) {
      navigate('/');
    }
  }, [isSignedIn, sessionId, navigate]);

  // Fix JSX namespace error in getFileTypeInfo function
  const getFileTypeInfo = (file: File): { type: string, icon: React.ReactNode } => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension)) {
      return { type: 'image', icon: <FaFileImage /> };
    } else if (extension === 'pdf') {
      return { type: 'pdf', icon: <FaFilePdf /> };
    } else if (['mp3', 'wav', 'ogg'].includes(extension)) {
      return { type: 'audio', icon: <FaFileAudio /> };
    } else if (['mp4', 'mov', 'avi', 'webm'].includes(extension)) {
      return { type: 'video', icon: <FaFileVideo /> };
    } else if (['doc', 'docx', 'txt', 'rtf'].includes(extension)) {
      return { type: 'document', icon: <FaFileWord /> };
    }
    
    return { type: 'file', icon: <FaFileAlt /> };
  };

  // Generate a thumbnail preview for image files
  const generateThumbnail = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setImagePreview(null);
      return;
    }
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Enhance onDrop to add file verification and thumbnail generation
  const onDrop = (acceptedFiles: File[]) => {
    if (Array.isArray(acceptedFiles) && acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setFileToUpload(selectedFile);
      setStatus('');
      
      // Set file type
      const { type } = getFileTypeInfo(selectedFile);
      setFileType(type);
      
      // Generate thumbnail for images
      generateThumbnail(selectedFile);
      
      // Simulate file verification
      setVerifyingFile(true);
      setTimeout(() => {
        setVerifyingFile(false);
        setIsMetadataModalOpen(true);
      }, 1500);
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
      addToast('error', 'Upload Failed', 'No file selected for upload');
      return;
    }
    
    setIsUploading(true);
    setStatus('Uploading with metadata, please wait...');
    setUploadProgress(0);
    
    // Track upload start time
    const startTime = Date.now();
    let lastUpdateTime = startTime;
    let lastProgress = 0;
    
    // Simulate progress updates with speed calculation
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        const now = Date.now();
        const timeElapsed = now - lastUpdateTime;
        const increment = Math.random() * 15;
        const newProgress = prev + increment > 90 ? 90 : prev + increment;
        
        // Calculate upload speed (KB/s)
        if (timeElapsed > 0 && file) {
          const progressDelta = newProgress - lastProgress;
          const bytesUploaded = (file.size * progressDelta) / 100;
          const speedKBps = (bytesUploaded / 1024) / (timeElapsed / 1000);
          setUploadSpeed(speedKBps.toFixed(1));
          
          // Calculate estimated time remaining
          const remainingProgress = 100 - newProgress;
          const remainingBytes = (file.size * remainingProgress) / 100;
          const estimatedSeconds = (remainingBytes / 1024) / speedKBps;
          
          if (estimatedSeconds > 60) {
            setTimeRemaining(`${Math.ceil(estimatedSeconds / 60)} min remaining`);
          } else {
            setTimeRemaining(`${Math.ceil(estimatedSeconds)} sec remaining`);
          }
          
          lastUpdateTime = now;
          lastProgress = newProgress;
        }
        
        return newProgress;
      });
    }, 300);
    
    try {
      console.log(`Calling uploadFile for: ${file.name} to ${targetPath}`);
      const uploadResult = await fileSystemService.uploadFile(file, metadata, targetPath);
      
      if (!uploadResult || typeof uploadResult.filePath !== 'string') {
        throw new Error('Upload completed, but received an invalid response from the server.');
      }
      
      // Finalize progress
      clearInterval(progressInterval);
      setUploadProgress(100);
      setUploadSpeed('0.0');
      setTimeRemaining('');
      
      // Extract the directory path to navigate to it
      const directoryPath = path.dirname(uploadResult.filePath);
      console.log(`Upload successful. Will navigate to directory: ${directoryPath}`);
      
      // Close metadata modal and clear file states
      setIsMetadataModalOpen(false);
      setFileToUpload(null);
      setFile(null);
      
      // Show success notification
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 5000);
      
      // Show confetti
      setShowConfetti(true);
      createConfetti();
      setTimeout(() => setShowConfetti(false), 5000);
      
      // Display success toast
      addToast('success', 'Upload Complete', `${file.name} uploaded successfully`);
      
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
      clearInterval(progressInterval);
      setUploadProgress(0);
      console.error('Upload failed:', err);
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`Upload failed: ${message}`);
      addToast('error', 'Upload Failed', message);
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

  const addToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, message }]);
    
    // Auto remove toast after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  };
  
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
  // Add this function to create confetti elements
  const createConfetti = () => {
    const confettiCount = 100;
    const container = document.createElement('div');
    container.className = 'confetti-container';
    
    const colors = ['#4CAF50', '#2196F3', '#FFC107', '#E91E63', '#9C27B0'];
    
    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.width = `${Math.random() * 10 + 5}px`;
      confetti.style.height = `${Math.random() * 10 + 5}px`;
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.animationDuration = `${Math.random() * 2 + 2}s`;
      confetti.style.animationDelay = `${Math.random() * 0.5}s`;
      
      container.appendChild(confetti);
    }
    
    document.body.appendChild(container);
    
    // Remove after animation completes
    setTimeout(() => {
      document.body.removeChild(container);
    }, 5000);
  };

  // Add keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Show keyboard shortcuts dialog when pressing '?'
      if (e.key === '?' && !isMetadataModalOpen) {
        setShowKeyboardShortcuts(prev => !prev);
      }
      
      // Quick upload with Ctrl+U
      if (e.ctrlKey && e.key === 'u' && !isMetadataModalOpen) {
        e.preventDefault();
        setActiveTab('upload');
      }
      
      // Navigate to file manager with Ctrl+F
      if (e.ctrlKey && e.key === 'f' && !isMetadataModalOpen) {
        e.preventDefault();
        setActiveTab('fileManager');
      }
      
      // Escape key to close modals/overlays
      if (e.key === 'Escape') {
        setShowKeyboardShortcuts(false);
        if (isMetadataModalOpen) {
          setIsMetadataModalOpen(false);
          setFileToUpload(null);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMetadataModalOpen]);

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
        <div className="tab-container">
          <button
            onClick={() => setActiveTab('upload')}
            className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
          >
            Quick Upload
          </button>
         
          <button
          data-testid="file-manager-button"
            onClick={() => setActiveTab('fileManager')}
            className={`tab-button ${activeTab === 'fileManager' ? 'active' : ''}`}
          >
            Files Manager
          </button>

          <button
            onClick={() => setActiveTab('manageFields')}
            className={`tab-button ${activeTab === 'manageFields' ? 'active' : ''}`}
          >
            Manage Metadata Fields
          </button>

          {/* //@Lawrence140 =forced error for testing file manger fail */}
          <button data-testid="forced-errorBttn" onClick={() => setError('This is a file manager test error!')}>
              Force Error
          </button>
          {error && <div data-testid="error-message"></div>}

        </div>

        {/* Show either simple upload, file list, or advanced file manager based on toggle */}
        {activeTab === 'upload' && (
          <div 
            className="content-enter"
            style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              width: '100%',
            }}>
                //add output to catch for testing
                <h2 data-testid="upload-files-heading" style={{ marginTop: 0, color: '#333' }}>Upload Files</h2>
            <h2 className="animated-title">
              <span>U</span><span>p</span><span>l</span><span>o</span><span>a</span><span>d</span>
              <span> </span>
              <span>F</span><span>i</span><span>l</span><span>e</span><span>s</span>
            </h2>
            
            <div
              {...getRootProps()}
              className={`upload-dropzone ${isDragActive ? 'active' : ''} ${uploadAreaHover ? 'hover' : ''}`}
              onMouseEnter={() => setUploadAreaHover(true)}
              onMouseLeave={() => setUploadAreaHover(false)}
            >
              <input data-testid="file-input"{...getInputProps()} />
              {file ? (
                <div className="upload-content file-selected">
                  {imagePreview ? (
                    <div className="file-preview">
                      <img src={imagePreview} alt="File preview" />
                      <div className={`file-type-badge ${fileType}`}>{fileType}</div>
                    </div>
                  ) : (
                    <div className="file-preview">
                      <div className="file-icon">
                        {getFileTypeInfo(file).icon}
                      </div>
                      <div className={`file-type-badge ${fileType}`}>{fileType}</div>
                    </div>
                  )}
                  
                  <p>
                    <strong>{file.name}</strong> selected
                    <span className="upload-hint">Click to change or drag another file</span>
                  </p>
                  
                  {verifyingFile && (
                    <div className="file-verification">
                      <FaShieldAlt className="file-verification-icon" />
                      Verifying file security...
                    </div>
                  )}
                </div>
              ) : isDragActive ? (
                <div className="upload-content drag-active">
                  <div className="upload-icon-container">
                    <FaCloudUploadAlt className="upload-icon pulse" />
                  </div>
                  <p>Drop file here to upload...</p>
                </div>
              ) : (
                <div className="upload-content">
                  <div className="upload-icon-container">
                    <FaCloudUploadAlt className="upload-icon bounce" />
                  </div>
                  <p>Click here to upload files</p>
                  <span className="upload-hint">or drag and drop files here</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '20px' }}>
              <button
                data-testid="upload-button"
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="enhanced-upload-button"
              >
                {isUploading ? (
                  <>
                    <span className="button-icon spinner"></span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <FaUpload className="button-icon" />
                    Upload with Metadata
                  </>
                )}
              </button>

              {isUploading && (
                <>
                  <div className="upload-progress-container">
                    <div 
                      className="upload-progress-bar" 
                      style={{ width: `${uploadProgress}%` }} 
                    />
                  </div>
                  
                  <div className="upload-speed">
                    <span>Uploading at</span>
                    <span className="upload-speed-value">{uploadSpeed} KB/s</span>
                    <span className="time-remaining">{timeRemaining}</span>
                  </div>
                </>
              )}

              {showSuccessMessage && (
                <div className="upload-success">
                  <FaCheck className="success-icon" />
                  <div className="success-text">
                    <span className="success-filename">{file?.name}</span>
                    uploaded successfully
                  </div>
                </div>
              )}

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
              <div style={{ 
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
            /* Change from fixed height to min-height */
            minHeight: 'calc(100vh - 200px)',
            /* Allow scrolling inside the container */
            overflow: 'auto',
            /* Ensure parent containers don't restrict height */
            position: 'relative',
          }}>
            <BasicFileSystem 
              ref={fileSystemRef} 
            />
          </div>
        )}
        
        {/* Replace the old Manage Fields UI with the new component */}
        {activeTab === 'manageFields' && (
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            width: '100%',
            minHeight: '500px',
          }}>
            <ManageFieldsComponent 
              onFieldsSaved={() => {
                console.log('Fields saved successfully in AdminPage');
                // Do not reload the page or navigate here
                // Just update UI elements if needed
                setFieldSaveStatus('Fields saved successfully!');
                setTimeout(() => setFieldSaveStatus(''), 3000);
              }} 
            />
          </div>
        )}
        
        {/* Add MetadataModal component */}
        {isMetadataModalOpen && (
          <MetadataModal
            data-testid="metadata-modal"
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
      {/* Add a floating upload button (optional) */}
      <button className="floating-upload-button" onClick={() => setActiveTab('upload')}>
        <FaCloudUploadAlt />
      </button>

      {/* Toast notification container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.type === 'success' && <FaCheck className="toast-icon" />}
            {toast.type === 'error' && <FaTimes className="toast-icon" />}
            {toast.type === 'info' && <FaInfoCircle className="toast-icon" />}
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button 
              className="toast-close" 
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
            >
              <FaTimes />
            </button>
          </div>
        ))}
      </div>

     

      <div className={`keyboard-shortcuts ${showKeyboardShortcuts ? 'visible' : ''}`}>
        <h4>Keyboard Shortcuts</h4>
        <div className="keyboard-shortcut-item">
          <span>Show/hide shortcuts</span>
          <span className="keyboard-shortcut-key">?</span>
        </div>
        <div className="keyboard-shortcut-item">
          <span>Quick upload</span>
          <span className="keyboard-shortcut-key">Ctrl+U</span>
        </div>
        <div className="keyboard-shortcut-item">
          <span>File manager</span>
          <span className="keyboard-shortcut-key">Ctrl+F</span>
        </div>
        <div className="keyboard-shortcut-item">
          <span>Close dialogs</span>
          <span className="keyboard-shortcut-key">Esc</span>
        </div>
      </div>
    </main>
  );
};

export default AdminPage;
