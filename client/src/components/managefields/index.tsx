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
      <section className="loading-container" aria-live="polite" aria-busy="true"> {/* Use section for semantic grouping */}
        <div className="loading-spinner"></div> {/* This div is fine for the spinner animation */}
        <p>Loading metadata fields...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="error-container" role="alert"> {/* Use section with role="alert" for errors */}
        <p className="error-icon">⚠️</p> {/* Changed div to p, suitable for a single icon/character */}
        <p>{error}</p>
        <button onClick={() => setError(null)}>Retry</button>
      </section>
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