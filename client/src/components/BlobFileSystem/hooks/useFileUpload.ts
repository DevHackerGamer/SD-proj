import { useState, useCallback } from 'react';
import { fileSystemService } from '../services/FileSystemService';
import type { UploadProgressInfo, FileMetadata } from '../types';

export const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showMetadataForm, setShowMetadataForm] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);

  /**
   * Prepare files for upload - this will show the metadata form
   */
  const prepareFilesForUpload = useCallback((files: File[] | FileList) => {
    if (!files.length) return;
    
    // Convert FileList to array
    const filesArray = Array.from(files);
    setFilesToUpload(filesArray);
    setShowMetadataForm(true);
  }, []);

  /**
   * Handle uploading files with metadata to the specified path
   */
  const uploadFilesWithMetadata = useCallback(async (
    files: File[], 
    targetPath: string,
    metadata: FileMetadata
  ) => {
    if (!files.length) return;
    
    setIsUploading(true);
    setUploadError(null);
    setShowMetadataForm(false);
    
    // Initialize progress tracking for each file
    const initialProgress: UploadProgressInfo[] = files.map(file => ({
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    }));
    
    setUploadProgress(initialProgress);
    
    try {
      // First, ensure the directory structure exists
      await fileSystemService.ensureDirectoryStructure(targetPath);
      
      // Create metadata.json in the directory
      await fileSystemService.createMetadataFile(targetPath, {
        ...metadata,
        directoryContents: files.map(f => f.name),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // Upload each file with its metadata
      const uploads = files.map(async (file, index) => {
        try {
          // Merge file-specific metadata with directory metadata
          const fileMetadata = {
            ...metadata,
            filename: file.name,
            fileType: file.name.split('.').pop()?.toLowerCase() || '',
            fileSize: file.size,
            uploadDate: new Date().toISOString()
          };
          
          // Upload the file with metadata
          await fileSystemService.uploadFileWithMetadata(
            file,
            `${targetPath}/${file.name}`,
            fileMetadata,
            {
              onProgress: (progress) => {
                setUploadProgress(prev => 
                  prev.map((item, i) => 
                    i === index ? { ...item, progress } : item
                  )
                );
              }
            }
          );
          
          // Update progress for this file to completed
          setUploadProgress(prev => 
            prev.map((item, i) => 
              i === index 
                ? { ...item, progress: 100, status: 'completed' } 
                : item
            )
          );
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          
          // Update progress for this file to error
          setUploadProgress(prev => 
            prev.map((item, i) => 
              i === index 
                ? { 
                    ...item, 
                    status: 'error', 
                    error: error instanceof Error ? error.message : 'Upload failed' 
                  } 
                : item
            )
          );
          
          throw error;
        }
      });
      
      // Wait for all uploads to complete
      await Promise.all(uploads);
    } catch (error) {
      setUploadError('One or more files failed to upload');
    } finally {
      setIsUploading(false);
      // Clear files to upload regardless of success/failure
      setFilesToUpload([]);
    }
  }, []);

  /**
   * Cancel the upload process
   */
  const cancelUpload = useCallback(() => {
    setShowMetadataForm(false);
    setFilesToUpload([]);
    setUploadProgress([]);
    setUploadError(null);
  }, []);

  return {
    isUploading,
    uploadProgress,
    uploadError,
    showMetadataForm,
    filesToUpload,
    prepareFilesForUpload,
    uploadFilesWithMetadata,
    cancelUpload
  };
};
