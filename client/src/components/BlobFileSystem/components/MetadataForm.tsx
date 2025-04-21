import React, { useState, useEffect } from 'react';
import type { FileMetadata, FileSystemItem } from '../types';
import '../styles.css';

// Predefined values for dropdown fields
export const METADATA_OPTIONS = {
  documentType: ["constitution", "amendment", "section", "article", "preamble", "annexure", "bill", "act", "regulation"],
  level: ["fonds", "series", "subseries", "file", "item"],
  language: ["en", "fr", "af", "zu", "xh", "ts", "st", "ve", "tn", "ss", "nr", "nso"],
  tags: ["democracy", "equality", "rule of law", "bill of rights", "freedom of speech", "parliament", "judiciary", "executive", "amendments", "land reform"],
  topics: ["judicial independence", "constitutional supremacy", "separation of powers", "customary law", "minority rights", "public participation", "gender equality", "citizenship", "voting rights"],
  accessLevel: ["public", "restricted", "admin-only"],
  fileType: ["pdf", "docx", "txt", "jpeg", "png", "mp3", "mp4", "wav", "avi"],
  country: ["South Africa", "Namibia", "Botswana", "Zimbabwe", "Lesotho", "Eswatini", "Mozambique"],
  jurisdiction: ["National", "Western Cape", "Gauteng", "KwaZulu-Natal", "Eastern Cape", "Free State", "Limpopo", "Mpumalanga", "North West", "Northern Cape"],
  license: ["Creative Commons BY-SA", "Creative Commons BY-NC", "Public Domain", "Government Copyright", "All Rights Reserved"],
  collection: ["1996 Constitution", "Bill of Rights Archive", "Transitional Provisions", "2021 Amendments", "Pre-Apartheid Legislation"]
};

interface MetadataFormProps {
  item: FileSystemItem;
  onSave: (metadata: FileMetadata) => void;
  onCancel: () => void;
}

const MetadataForm: React.FC<MetadataFormProps> = ({ item, onSave, onCancel }) => {
  const [metadata, setMetadata] = useState<FileMetadata>(item.metadata || {});
  const [tagsInput, setTagsInput] = useState<string>('');
  
  useEffect(() => {
    // Convert tags array to comma-separated string for input field
    if (item.metadata?.tags && Array.isArray(item.metadata.tags)) {
      setTagsInput(item.metadata.tags.join(', '));
    } else if (typeof item.metadata?.tags === 'string') {
      // Handle case where tags is incorrectly stored as string
      setTagsInput(item.metadata.tags);
    } else {
      setTagsInput('');
    }
  }, [item]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setMetadata(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagsInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Process tags from comma-separated string to array
    const processedMetadata = {
      ...metadata,
      // Convert string of tags to array
      tags: tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
    };
    
    onSave(processedMetadata);
  };

  return (
    <div className="metadata-form-overlay">
      <div className="metadata-form">
        <h2>Edit Metadata: {item.name}</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={metadata.title || ''}
              onChange={handleInputChange}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={metadata.description || ''}
              onChange={handleInputChange}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="documentType">Document Type</label>
            <select
              id="documentType"
              name="documentType"
              value={metadata.documentType || ''}
              onChange={handleInputChange}
            >
              <option value="">Select a type</option>
              {METADATA_OPTIONS.documentType.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="tags">Tags (comma separated)</label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={tagsInput}
              onChange={handleTagsChange}
              placeholder="e.g. democracy, rights, freedom"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="accessLevel">Access Level</label>
            <select
              id="accessLevel"
              name="accessLevel"
              value={metadata.accessLevel || 'public'}
              onChange={handleInputChange}
            >
              {METADATA_OPTIONS.accessLevel.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          
          <div className="form-actions">
            <button type="button" className="cancel-button" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="save-button">
              Save Metadata
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MetadataForm;
