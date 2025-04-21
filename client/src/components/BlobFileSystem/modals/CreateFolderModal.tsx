import React, { useState } from 'react';

interface CreateFolderModalProps {
  onClose: () => void;
  onSubmit: (folderName: string) => void;
}

const CreateFolderModal: React.FC<CreateFolderModalProps> = ({ onClose, onSubmit }) => {
  const [folderName, setFolderName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate folder name
    if (!folderName.trim()) {
      setError('Please enter a folder name');
      return;
    }
    
    // Check for invalid characters in the folder name
    if (/[<>:"/\\|?*]/.test(folderName)) {
      setError('Folder name cannot contain any of the following characters: < > : " / \\ | ? *');
      return;
    }
    
    onSubmit(folderName.trim());
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '4px',
        padding: '24px',
        width: '400px',
        maxWidth: '90%',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px' }}>Create New Folder</h2>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label 
              htmlFor="folderName" 
              style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}
            >
              Folder Name:
            </label>
            <input
              id="folderName"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '16px'
              }}
              autoFocus
            />
            {error && (
              <p style={{ color: '#dc3545', marginTop: '8px', fontSize: '14px' }}>
                {error}
              </p>
            )}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateFolderModal;
