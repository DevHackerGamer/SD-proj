import React, { useState, useEffect } from 'react';
import EnhancedFieldsUI from './EnhancedFieldsUI';
import metadataOptionsData from './metadataOptions.json';

interface ManageFieldsComponentProps {
  onFieldsSaved: () => void;
}

const ManageFieldsComponent: React.FC<ManageFieldsComponentProps> = ({ onFieldsSaved }) => {
  const [metadataOptions, setMetadataOptions] = useState(metadataOptionsData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 600);
    
    return () => clearTimeout(timer);
  }, []);

  // This function would be called when saving changes
  const handleFieldsSaved = async () => {
    try {
      // Here you would call your API to save the data
      // For now we're just using the local data
      console.log('Saving metadata options:', metadataOptions);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Call the parent callback
      onFieldsSaved();
    } catch (err) {
      console.error('Error saving fields:', err);
      setError('Failed to save fields. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading metadata fields...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">⚠️</div>
        <p>{error}</p>
        <button onClick={() => setError(null)}>Retry</button>
      </div>
    );
  }

  return (
    <EnhancedFieldsUI 
      metadataOptions={metadataOptions} 
      onFieldsSaved={handleFieldsSaved}
    />
  );
};

export default ManageFieldsComponent;
