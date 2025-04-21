import React, { useState, useEffect } from 'react';
import { fileSystemService } from '../services/FileSystemService';
import type { FileMetadata } from '../types';
import { METADATA_OPTIONS } from './MetadataForm';
import '../styles.css';

interface MetadataEditorProps {
  item: any;
  onSave: () => void;
  onCancel: () => void;
}

const MetadataEditor: React.FC<MetadataEditorProps> = ({ 
  item, 
  onSave, 
  onCancel 
}) => {
  const [metadata, setMetadata] = useState<FileMetadata>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        setLoading(true);
        const data = await fileSystemService.getItemMetadata(item.path);
        setMetadata(data);
      } catch (error) {
        console.error('Error loading metadata:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadMetadata();
  }, [item]);
  
  const updateField = (field: string, value: any) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      await fileSystemService.updateItemMetadata(item.path, metadata);
      onSave();
    } catch (error) {
      console.error('Error saving metadata:', error);
      alert('Failed to save metadata');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return <div className="metadata-editor-loading">Loading metadata...</div>;
  }
  
  return (
    <div className="metadata-editor-overlay">
      <div className="metadata-editor">
        <h2>Edit Metadata</h2>
        <h3>{item.name}</h3>
        
        <form onSubmit={handleSubmit}>
          {/* Simplified form for example */}
          <div className="form-field">
            <label htmlFor="documentType">Document Type</label>
            <select
              id="documentType"
              value={metadata.documentType || ''}
              onChange={(e) => updateField('documentType', e.target.value)}
            >
              <option value="">Select type...</option>
              {METADATA_OPTIONS.documentType.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          
          <div className="form-field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={metadata.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="save-btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save Metadata'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MetadataEditor;
