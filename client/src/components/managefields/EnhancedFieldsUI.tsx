import React, { useState, useEffect, useRef } from 'react';
import { 
  FaLayerGroup, FaTag, FaPencilAlt, FaTrash, FaPlus, 
  FaArrowLeft, FaSearch, FaSave, FaFolder, FaFolderOpen, 
  FaListAlt, FaDatabase, FaExclamationTriangle, FaTimes, FaCheck, FaInfoCircle,
  FaFileAlt, FaGlobe, FaLock, FaFile, FaCopyright, FaQuestionCircle, FaGripVertical
} from 'react-icons/fa';
import './ManageFields.css';

// Type definitions for our metadata options
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
  [key: string]: string[] | Record<string, string[]>;
};

// Icons for each category
const categoryIcons: Record<string, React.ReactNode> = {
  collection: <FaDatabase />,
  jurisdictionType: <FaLayerGroup />,
  jurisdictionName: <FaFolder />,
  thematicFocusPrimary: <FaTag />,
  thematicFocusSubthemes: <FaFolderOpen />,
  issuingAuthorityType: <FaListAlt />,
  issuingAuthorityName: <FaListAlt />,
  documentFunction: <FaFileAlt />,
  version: <FaPencilAlt />,
  workflowStagePrimary: <FaLayerGroup />,
  workflowStageSub: <FaFolderOpen />,
  language: <FaGlobe />,
  accessLevel: <FaLock />,
  fileType: <FaFile />,
  license: <FaCopyright />
};

// Props type definition
interface EnhancedFieldsUIProps {
  metadataOptions: MetadataOptionsType;
  onFieldsSaved: () => void;
}

const EnhancedFieldsUI: React.FC<EnhancedFieldsUIProps> = ({ metadataOptions, onFieldsSaved }) => {
  // State management
  const [selectedCategory, setSelectedCategory] = useState<keyof MetadataOptionsType | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<{ value: string; index: number } | null>(null);
  const [newFieldValue, setNewFieldValue] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatedMetadataOptions, setUpdatedMetadataOptions] = useState<MetadataOptionsType>(metadataOptions);
  
  // Add these new states for better user interaction
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [highlightedField, setHighlightedField] = useState<number | null>(null);
  const [showFieldGuide, setShowFieldGuide] = useState<boolean>(false);
  const [isDraggingField, setIsDraggingField] = useState<boolean>(false);
  const [draggedField, setDraggedField] = useState<{ index: number; value: string } | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Effects
  useEffect(() => {
    // Reset search when changing categories
    setSearchTerm('');
  }, [selectedCategory, selectedSubCategory]);

  // Add a field to highlight most recently added or modified field
  useEffect(() => {
    if (highlightedField !== null) {
      // Auto-scroll to the highlighted field
      setTimeout(() => {
        const fieldElement = document.getElementById(`field-item-${highlightedField}`);
        if (fieldElement) {
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Clear the highlight after animation completes
        setTimeout(() => setHighlightedField(null), 3000);
      }, 100);
    }
  }, [highlightedField]);

  // Helper functions
  const formatCategoryName = (name: string): string => {
    return name
      .replace(/([A-Z])/g, ' $1') // Insert a space before all uppercase letters
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/^\w/, c => c.toUpperCase()); // Capitalize the first letter
  };

  const getFieldCount = (category: keyof MetadataOptionsType): { total: number; visible: number } => {
    const value = updatedMetadataOptions[category];
    if (Array.isArray(value)) {
      return { total: value.length, visible: value.length };
    } else if (typeof value === 'object') {
      // Count all fields in all subcategories
      const total = Object.values(value).reduce((sum, arr) => sum + arr.length, 0);
      return { total, visible: total };
    }
    return { total: 0, visible: 0 };
  };

  const getSubCategoriesCount = (category: keyof MetadataOptionsType): number => {
    const value = updatedMetadataOptions[category];
    if (typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).length;
    }
    return 0;
  };

  const getFilteredFields = (): string[] => {
    if (!selectedCategory) return [];

    if (selectedSubCategory) {
      const categoryValue = updatedMetadataOptions[selectedCategory];
      if (typeof categoryValue === 'object' && !Array.isArray(categoryValue)) {
        const subCategoryFields = categoryValue[selectedSubCategory] || [];
        if (!searchTerm) return subCategoryFields;
        return subCategoryFields.filter(field => 
          field.toLowerCase().includes(searchTerm.toLowerCase()));
      }
    } else {
      const categoryValue = updatedMetadataOptions[selectedCategory];
      if (Array.isArray(categoryValue)) {
        if (!searchTerm) return categoryValue;
        return categoryValue.filter(field => 
          field.toLowerCase().includes(searchTerm.toLowerCase()));
      }
    }

    return [];
  };

  const getSubCategories = (): string[] => {
    if (!selectedCategory) return [];

    const categoryValue = updatedMetadataOptions[selectedCategory];
    if (typeof categoryValue === 'object' && !Array.isArray(categoryValue)) {
      if (!searchTerm) return Object.keys(categoryValue);
      return Object.keys(categoryValue).filter(subCat => 
        subCat.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return [];
  };

  const isHierarchicalField = (): boolean => {
    if (!selectedCategory) return false;
    return typeof updatedMetadataOptions[selectedCategory] === 'object' && 
           !Array.isArray(updatedMetadataOptions[selectedCategory]);
  };

  // Enhanced version of handleAddField with better feedback
  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !newFieldValue.trim()) return;

    setIsSubmitting(true);
    setStatusMessage({ type: 'info', text: 'Adding field...' });

    // Simulate small delay for better user feedback
    setTimeout(() => {
      const updatedOptions = { ...updatedMetadataOptions };

      if (selectedSubCategory) {
        const categoryValue = updatedOptions[selectedCategory];
        if (typeof categoryValue === 'object' && !Array.isArray(categoryValue)) {
          if (!categoryValue[selectedSubCategory]) {
            categoryValue[selectedSubCategory] = [];
          }
          
          // Add the new field and get its index
          const newIndex = categoryValue[selectedSubCategory].length;
          categoryValue[selectedSubCategory] = [...categoryValue[selectedSubCategory], newFieldValue];
          
          // Set this field to be highlighted
          setHighlightedField(newIndex);
        }
      } else if (isHierarchicalField()) {
        // Adding a new subcategory
        const categoryValue = updatedOptions[selectedCategory];
        if (typeof categoryValue === 'object' && !Array.isArray(categoryValue)) {
          categoryValue[newFieldValue] = [];
        }
      } else {
        const categoryValue = updatedOptions[selectedCategory];
        if (Array.isArray(categoryValue)) {
          // Add the new field and get its index
          const newIndex = categoryValue.length;
          updatedOptions[selectedCategory] = [...categoryValue, newFieldValue];
          
          // Set this field to be highlighted
          setHighlightedField(newIndex);
        }
      }

      setUpdatedMetadataOptions(updatedOptions);
      setNewFieldValue('');
      setIsSubmitting(false);
      
      // Show success with animation
      setStatusMessage({ 
        type: 'success', 
        text: `Field "${newFieldValue}" added successfully` 
      });
      
      // Clear form reference
      if (formRef.current) {
        formRef.current.reset();
      }
      
      // Scroll to the added field with highlight effect
      setTimeout(() => {
        const fieldsList = document.querySelector('.fields-list');
        if (fieldsList) {
          fieldsList.scrollTop = fieldsList.scrollHeight;
        }
      }, 100);
    }, 600);
  };

  const handleUpdateField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !editingField || !newFieldValue.trim()) return;

    const updatedOptions = { ...updatedMetadataOptions };

    if (selectedSubCategory) {
      const categoryValue = updatedOptions[selectedCategory];
      if (typeof categoryValue === 'object' && !Array.isArray(categoryValue)) {
        const fields = [...categoryValue[selectedSubCategory]];
        fields[editingField.index] = newFieldValue;
        categoryValue[selectedSubCategory] = fields;
      }
    } else {
      const categoryValue = updatedOptions[selectedCategory];
      if (Array.isArray(categoryValue)) {
        const fields = [...categoryValue];
        fields[editingField.index] = newFieldValue;
        updatedOptions[selectedCategory] = fields;
      }
    }

    setUpdatedMetadataOptions(updatedOptions);
    setEditingField(null);
    setNewFieldValue('');
    showStatus('success', 'Field updated successfully');
  };

  const handleDeleteField = (index: number) => {
    if (!selectedCategory) return;

    const updatedOptions = { ...updatedMetadataOptions };

    if (selectedSubCategory) {
      const categoryValue = updatedOptions[selectedCategory];
      if (typeof categoryValue === 'object' && !Array.isArray(categoryValue)) {
        const fields = [...categoryValue[selectedSubCategory]];
        fields.splice(index, 1);
        categoryValue[selectedSubCategory] = fields;
      }
    } else {
      const categoryValue = updatedOptions[selectedCategory];
      if (Array.isArray(categoryValue)) {
        const fields = [...categoryValue];
        fields.splice(index, 1);
        updatedOptions[selectedCategory] = fields;
      }
    }

    setUpdatedMetadataOptions(updatedOptions);
    showStatus('success', 'Field deleted successfully');
  };

  // Enhanced version of handleSaveAllChanges with better feedback
  const handleSaveAllChanges = async () => {
    setIsSubmitting(true);
    setStatusMessage({ type: 'info', text: 'Saving all changes...' });
    
    try {
      // This would be an API call in a real implementation
      await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate API call
      onFieldsSaved();
      
      setStatusMessage({ 
        type: 'success', 
        text: 'All changes saved successfully! Your metadata structure has been updated.' 
      });
      
      // Add confetti effect for successful save
      createConfetti();
    } catch (error) {
      console.error('Error saving metadata options:', error);
      setStatusMessage({ 
        type: 'error', 
        text: 'Error saving changes. Please try again or contact support if the issue persists.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Add a confetti animation function for successful saves
  const createConfetti = () => {
    const confettiCount = 100;
    const colors = ['#4299e1', '#48bb78', '#ed8936', '#667eea'];
    
    const confettiContainer = document.createElement('div');
    confettiContainer.style.position = 'fixed';
    confettiContainer.style.zIndex = '9999';
    confettiContainer.style.top = '0';
    confettiContainer.style.left = '0';
    confettiContainer.style.width = '100%';
    confettiContainer.style.height = '100%';
    confettiContainer.style.pointerEvents = 'none';
    
    document.body.appendChild(confettiContainer);
    
    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'absolute';
      confetti.style.width = `${Math.random() * 10 + 5}px`;
      confetti.style.height = `${Math.random() * 5 + 3}px`;
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = `${Math.random() * 100}%`;
      confetti.style.top = '-20px';
      confetti.style.borderRadius = '2px';
      confetti.style.opacity = `${Math.random() * 0.5 + 0.5}`;
      confetti.style.animation = `confettiFall ${Math.random() * 3 + 2}s linear forwards`;
      
      const keyframes = `
        @keyframes confettiFall {
          to {
            transform: translateY(${window.innerHeight}px) rotate(${Math.random() * 360}deg);
          }
        }
      `;
      
      const style = document.createElement('style');
      style.innerHTML = keyframes;
      document.head.appendChild(style);
      
      confettiContainer.appendChild(confetti);
    }
    
    // Remove confetti after animation
    setTimeout(() => {
      document.body.removeChild(confettiContainer);
    }, 5000);
  };

  // Render the categories overview
  const renderCategoriesOverview = () => (
    <div className="categories-section">
      <h2 className="categories-title">
        <FaLayerGroup /> Metadata Categories
      </h2>
      <div className="categories-grid">
        {Object.keys(updatedMetadataOptions).map(category => {
          const { total: fieldCount } = getFieldCount(category as keyof MetadataOptionsType);
          const isExpanded = expandedCard === category;
          const isHierarchical = typeof updatedMetadataOptions[category as keyof MetadataOptionsType] === 'object' && 
                                !Array.isArray(updatedMetadataOptions[category as keyof MetadataOptionsType]);
          const subCategoriesCount = isHierarchical ? 
                                    Object.keys(updatedMetadataOptions[category as keyof MetadataOptionsType] as Record<string, string[]>).length : 0;
          
          return (
            <div
              key={category}
              className={`category-card ${isExpanded ? 'expanded' : ''}`}
              onClick={() => handleCategorySelect(category as keyof MetadataOptionsType)}
              onMouseEnter={() => setExpandedCard(category)}
              onMouseLeave={() => setExpandedCard(null)}
              role="button"
              tabIndex={0}
              aria-label={`Select ${formatCategoryName(category)} category`}
              onKeyDown={(e) => e.key === 'Enter' && handleCategorySelect(category as keyof MetadataOptionsType)}
            >
              <div className="category-icon">
                {categoryIcons[category] || <FaTag />}
              </div>
              <div className="category-name">{formatCategoryName(category)}</div>
              <div className="category-stats">
                <div className="category-count">
                  <span className="count-label">Fields:</span> 
                  <span className="count-value">{fieldCount}</span>
                </div>
                {isHierarchical && (
                  <div className="subcategory-count">
                    <span className="count-label">Subcategories:</span>
                    <span className="count-value">{subCategoriesCount}</span>
                  </div>
                )}
              </div>
              
              {isExpanded && (
                <div className="category-preview">
                  <div className="preview-fields">
                    {Array.isArray(updatedMetadataOptions[category as keyof MetadataOptionsType]) ? 
                      (updatedMetadataOptions[category as keyof MetadataOptionsType] as string[])
                        .slice(0, 3)
                        .map((field, idx) => (
                          <div key={idx} className="preview-field">{field}</div>
                        )) : 
                      isHierarchical ? 
                        Object.keys(updatedMetadataOptions[category as keyof MetadataOptionsType] as Record<string, string[]>)
                          .slice(0, 3)
                          .map((subcategory, idx) => (
                            <div key={idx} className="preview-field">{subcategory}</div>
                          )) : 
                        null
                    }
                    {((Array.isArray(updatedMetadataOptions[category as keyof MetadataOptionsType]) && 
                      (updatedMetadataOptions[category as keyof MetadataOptionsType] as string[]).length > 3) ||
                      (isHierarchical && 
                      Object.keys(updatedMetadataOptions[category as keyof MetadataOptionsType] as Record<string, string[]>).length > 3)) && (
                      <div className="preview-more">+ more</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // Action handlers for category selection and navigation
  const handleCategorySelect = (category: keyof MetadataOptionsType) => {
    setSelectedCategory(category);
    setSelectedSubCategory(null);
    setEditingField(null);
    setNewFieldValue('');
  };

  const handleSubCategorySelect = (subCategory: string) => {
    setSelectedSubCategory(subCategory);
    setEditingField(null);
    setNewFieldValue('');
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSelectedSubCategory(null);
    setEditingField(null);
    setNewFieldValue('');
  };

  const handleBackToSubCategories = () => {
    setSelectedSubCategory(null);
    setEditingField(null);
    setNewFieldValue('');
  };

  const handleEditField = (value: string, index: number) => {
    setEditingField({ value, index });
    setNewFieldValue(value);
  };

  // Render the subcategories view
  const renderSubCategoriesView = () => {
    if (!selectedCategory) return null;
    
    const subcategories = getSubCategories();
    
    return (
      <div className="field-management">
        <div className="field-header">
          <h3 className="field-title">
            <FaFolderOpen /> {formatCategoryName(selectedCategory as string)} Subcategories
          </h3>
          <div className="breadcrumb">
            <span className="breadcrumb-item" onClick={handleBackToCategories}>
              Categories
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{formatCategoryName(selectedCategory as string)}</span>
          </div>
        </div>
        
        <div className="search-box">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search subcategories..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        {subcategories.length > 0 ? (
          <div className="subcategory-grid">
            {subcategories.map(subCategory => (
              <div
                key={subCategory}
                className="subcategory-card"
                onClick={() => handleSubCategorySelect(subCategory)}
              >
                <div className="subcategory-name">{formatCategoryName(subCategory)}</div>
                <div className="subcategory-count">
                  {typeof updatedMetadataOptions[selectedCategory] === 'object' && 
                   !Array.isArray(updatedMetadataOptions[selectedCategory]) &&
                   (updatedMetadataOptions[selectedCategory] as Record<string, string[]>)[subCategory]?.length || 0} fields
                </div>
              </div>
            ))}
          </div>
        ) : searchTerm ? (
          <div className="empty-state">
            <div className="empty-icon"><FaExclamationTriangle /></div>
            <div className="empty-message">No subcategories found matching "{searchTerm}"</div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><FaFolder /></div>
            <div className="empty-message">No subcategories found. Add your first subcategory below.</div>
          </div>
        )}
        
        <form className="field-form" onSubmit={handleAddField} ref={formRef}>
          <div className="form-header">
            <h4 className="form-title">
              <FaPlus /> Add New Subcategory
            </h4>
          </div>
          <div className="form-group">
            <label htmlFor="newSubcategory">Subcategory Name</label>
            <input
              type="text"
              id="newSubcategory"
              className="form-control"
              value={newFieldValue}
              onChange={e => setNewFieldValue(e.target.value)}
              placeholder="Enter subcategory name..."
              disabled={isSubmitting}
            />
            <div className="help-text">
              <span className="help-text-icon">💡</span>
              Use underscores instead of spaces (e.g., "My_Subcategory")
            </div>
          </div>
          <div className="form-actions">
            <button 
              type="submit" 
              className="submit-button" 
              disabled={!newFieldValue.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="button-spinner"></div>
                  Adding...
                </>
              ) : (
                <>
                  <FaPlus /> Add Subcategory
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Render the fields list view with drag/drop
  const renderFieldsListView = () => {
    if (!selectedCategory) return null;
    
    const fields = getFilteredFields();
    const currentCategory = formatCategoryName(selectedCategory as string);
    const currentSubCategory = selectedSubCategory ? formatCategoryName(selectedSubCategory) : null;
    
    // Handle field drag/drop interactions
    const handleFieldDragStart = (index: number, value: string) => (e: React.DragEvent<HTMLDivElement>) => {
      setIsDraggingField(true);
      setDraggedField({ index, value });
      e.currentTarget.classList.add('dragging');
    };
    
    const handleFieldDragEnd = () => {
      setIsDraggingField(false);
      setDraggedField(null);
      document.querySelectorAll('.field-item').forEach(el => {
        el.classList.remove('dragging');
        el.classList.remove('drag-over');
      });
    };
    
    const handleFieldDragOver = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (draggedField && draggedField.index !== index) {
        e.currentTarget.classList.add('drag-over');
      }
    };
    
    const handleFieldDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.currentTarget.classList.remove('drag-over');
    };
    
    const handleFieldDrop = (index: number) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.classList.remove('drag-over');
      
      if (draggedField && draggedField.index !== index) {
        // Reorder the fields
        const updatedOptions = { ...updatedMetadataOptions };
        
        if (selectedSubCategory) {
          const categoryValue = updatedOptions[selectedCategory];
          if (typeof categoryValue === 'object' && !Array.isArray(categoryValue)) {
            const fields = [...categoryValue[selectedSubCategory]];
            const [removed] = fields.splice(draggedField.index, 1);
            fields.splice(index, 0, removed);
            categoryValue[selectedSubCategory] = fields;
          }
        } else {
          const categoryValue = updatedOptions[selectedCategory];
          if (Array.isArray(categoryValue)) {
            const fields = [...categoryValue];
            const [removed] = fields.splice(draggedField.index, 1);
            fields.splice(index, 0, removed);
            updatedOptions[selectedCategory] = fields;
          }
        }
        
        setUpdatedMetadataOptions(updatedOptions);
        setStatusMessage({ type: 'info', text: 'Field order updated' });
        
        // Clear the message after a short delay
        setTimeout(() => {
          setStatusMessage(null);
        }, 2000);
      }
      
      setIsDraggingField(false);
      setDraggedField(null);
    };
    
    return (
      <div className="field-management">
        <div className="field-header">
          <div className="field-title-area">
            <h3 className="field-title">
              <FaTag className="field-icon" /> 
              Manage Fields
              <span className="field-location">
                {selectedSubCategory ? 
                  `${currentCategory} › ${currentSubCategory}` : 
                  currentCategory}
              </span>
            </h3>
            <button 
              type="button" 
              className="field-guide-button"
              onClick={() => setShowFieldGuide(!showFieldGuide)}
              aria-label={showFieldGuide ? "Hide field guide" : "Show field guide"}
            >
              <FaQuestionCircle />
            </button>
          </div>
          
          <div className="breadcrumb">
            <button 
              type="button"
              className="breadcrumb-item" 
              onClick={handleBackToCategories}
              aria-label="Back to categories"
            >
              <FaArrowLeft className="breadcrumb-icon" /> Categories
            </button>
            <span className="breadcrumb-separator">/</span>
            {selectedSubCategory ? (
              <>
                <button 
                  type="button"
                  className="breadcrumb-item" 
                  onClick={handleBackToSubCategories}
                  aria-label={`Back to ${currentCategory} subcategories`}
                >
                  {currentCategory}
                </button>
                <span className="breadcrumb-separator">/</span>
                <span className="breadcrumb-current">{currentSubCategory}</span>
              </>
            ) : (
              <span className="breadcrumb-current">{currentCategory}</span>
            )}
          </div>
        </div>
        
        {showFieldGuide && (
          <div className="field-guide">
            <div className="field-guide-header">
              <h4>Field Management Guide</h4>
              <button 
                type="button" 
                className="close-guide" 
                onClick={() => setShowFieldGuide(false)}
                aria-label="Close field guide"
              >
                <FaTimes />
              </button>
            </div>
            <div className="field-guide-content">
              <p>
                <strong>Adding Fields:</strong> Enter a new field value in the form below and click "Add Field".
              </p>
              <p>
                <strong>Editing:</strong> Click the edit icon next to any field to modify its value.
              </p>
              <p>
                <strong>Reordering:</strong> Drag and drop fields to change their order.
              </p>
              <p>
                <strong>Naming Convention:</strong> Use underscores instead of spaces (e.g., "My_Field_Value").
              </p>
              <p>
                <strong>Remember to save:</strong> Click "Save All Changes" when you're done to persist your changes.
              </p>
            </div>
          </div>
        )}
        
        <div className="search-tools">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder={`Search ${selectedSubCategory ? 'fields' : 'categories'}...`}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="search-input"
              aria-label="Search fields"
            />
            {searchTerm && (
              <button 
                type="button"
                className="clear-search" 
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
              >
                <FaTimes />
              </button>
            )}
          </div>
          <div className="search-stats">
            {searchTerm ? 
              `${fields.length} result${fields.length !== 1 ? 's' : ''} found` : 
              `${fields.length} total field${fields.length !== 1 ? 's' : ''}`}
          </div>
        </div>
        
        <div className="fields-container">
          {fields.length > 0 ? (
            <>
              <div className="field-list-header">
                <span>Field Value</span>
                <span>Actions</span>
              </div>
              <div className="fields-list">
                {fields.map((field, index) => (
                  <div 
                    key={index} 
                    id={`field-item-${index}`}
                    className={`field-item ${highlightedField === index ? 'highlighted' : ''}`}
                    draggable="true"
                    onDragStart={handleFieldDragStart(index, field)}
                    onDragEnd={handleFieldDragEnd}
                    onDragOver={handleFieldDragOver(index)}
                    onDragLeave={handleFieldDragLeave}
                    onDrop={handleFieldDrop(index)}
                  >
                    <div className="field-name">
                      <span className="field-grip">
                        <FaGripVertical className="grip-icon" />
                      </span>
                      {field}
                    </div>
                    <div className="field-actions">
                      <button
                        type="button"
                        className="edit-button"
                        onClick={() => handleEditField(field, index)}
                        title="Edit field"
                        aria-label={`Edit field ${field}`}
                      >
                        <FaPencilAlt />
                      </button>
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => handleDeleteField(index)}
                        title="Delete field"
                        aria-label={`Delete field ${field}`}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : searchTerm ? (
            <div className="empty-state">
              <div className="empty-icon"><FaExclamationTriangle /></div>
              <div className="empty-message">No fields found matching "{searchTerm}"</div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><FaTag /></div>
              <div className="empty-message">No fields found. Add your first field below.</div>
              <button
                type="button"
                className="add-first-button"
                onClick={() => {
                  // Focus the input field
                  const input = document.getElementById('newField');
                  if (input) input.focus();
                }}
              >
                <FaPlus /> Add First Field
              </button>
            </div>
          )}
        </div>
        
        <form className="field-form" onSubmit={editingField ? handleUpdateField : handleAddField} ref={formRef}>
          <div className="form-header">
            <h4 className="form-title">
              {editingField ? <FaPencilAlt /> : <FaPlus />}
              {editingField ? ' Edit Field' : ' Add New Field'}
            </h4>
          </div>
          <div className="form-group">
            <label htmlFor="newField">Field Value</label>
            <input
              type="text"
              id="newField"
              className="form-control"
              value={newFieldValue}
              onChange={e => setNewFieldValue(e.target.value)}
              placeholder="Enter field value..."
              aria-invalid={!!newFieldValue && !newFieldValue.trim().length}
              disabled={isSubmitting}
            />
            <div className="help-text">
              <span className="help-text-icon">💡</span>
              Use underscores instead of spaces (e.g., "My_Field_Value")
            </div>
            
            {newFieldValue && !newFieldValue.includes('_') && newFieldValue.includes(' ') && (
              <div className="validation-warning">
                <FaExclamationTriangle className="warning-icon" />
                Spaces detected! Consider using underscores instead.
              </div>
            )}
          </div>
          <div className="form-actions">
            <button 
              type="submit" 
              className="submit-button" 
              disabled={!newFieldValue.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="button-spinner"></div>
                  {editingField ? 'Updating...' : 'Adding...'}
                </>
              ) : (
                <>
                  {editingField ? <FaPencilAlt /> : <FaPlus />}
                  {editingField ? ' Update Field' : ' Add Field'}
                </>
              )}
            </button>
            
            {editingField && (
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setEditingField(null);
                  setNewFieldValue('');
                }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="manage-fields-container">
      <div className="manage-fields-header">
        <h1 className="manage-fields-title">Metadata Fields Manager</h1>
        <p className="manage-fields-subtitle">
          Manage the metadata fields used for organizing and categorizing your files
        </p>
        <div className="animated-underline"></div>
      </div>
      
      {!selectedCategory ? (
        renderCategoriesOverview()
      ) : isHierarchicalField() && !selectedSubCategory ? (
        renderSubCategoriesView()
      ) : (
        renderFieldsListView()
      )}
      
      {(selectedCategory || selectedSubCategory) && (
        <div className="save-changes">
          <button 
            className={`save-all-button ${isSubmitting ? 'submitting' : ''}`}
            onClick={handleSaveAllChanges}
            disabled={isSubmitting}
            aria-label="Save all changes"
          >
            {isSubmitting ? (
              <>
                <div className="button-spinner"></div>
                Saving Changes...
              </>
            ) : (
              <>
                <FaSave /> Save All Changes
              </>
            )}
          </button>
        </div>
      )}
      
      {statusMessage && (
        <div 
          className={`status-message status-${statusMessage.type}`}
          role="alert"
          aria-live="polite"
        >
          {statusMessage.type === 'success' && <FaCheck className="status-icon" />}
          {statusMessage.type === 'error' && <FaTimes className="status-icon" />}
          {statusMessage.type === 'info' && <FaInfoCircle className="status-icon" />}
          {statusMessage.text}
        </div>
      )}
    </div>
  );
};

export default EnhancedFieldsUI;
