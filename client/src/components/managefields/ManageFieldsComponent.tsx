import React, { useState, useEffect, useRef } from 'react';
import styles from './ManageFieldsComponent.module.css';
import metadataOptionsData from './metadataOptions.json';
import { metadataService } from '../../services/MetadataService';

// Define type for metadata options
export type MetadataOptionsType = {
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

interface ManageFieldsComponentProps {
  onFieldsSaved?: () => void;
  onCategorySelected?: (category: string) => void;
}

const ManageFieldsComponent: React.FC<ManageFieldsComponentProps> = ({ onFieldsSaved, onCategorySelected }) => {
  // State for metadata fields management
  const [metadataOptions, setMetadataOptions] = useState<MetadataOptionsType>(metadataOptionsData as MetadataOptionsType);
  const [selectedFieldCategory, setSelectedFieldCategory] = useState<keyof MetadataOptionsType | null>(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [newFieldValue, setNewFieldValue] = useState<string>('');
  const [isAPIAvailable, setIsAPIAvailable] = useState<boolean>(true);
  const [namingError, setNamingError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showNamingGuide, setShowNamingGuide] = useState<boolean>(false);
  const [viewNonHierarchicalFields, setViewNonHierarchicalFields] = useState<boolean>(false);
  
  // Add refs for debouncing and preventing double-submission
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const localOptionsRef = useRef<MetadataOptionsType | null>(null);
  const unsubscribeRef = useRef<Function | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Subscribe to updates from the metadata service
  useEffect(() => {
    // Function to handle updates from the service
    const handleMetadataUpdate = (updatedOptions: MetadataOptionsType) => {
      console.log('[ManageFieldsComponent] Received metadata update');
      setMetadataOptions(updatedOptions as MetadataOptionsType);
    };

    // Subscribe to updates
    unsubscribeRef.current = metadataService.subscribe(handleMetadataUpdate);
    
    // Initial load of metadata
    const loadInitialMetadata = async () => {
      try {
        const options = await metadataService.getOptions();
        setMetadataOptions(options as MetadataOptionsType);
        setIsAPIAvailable(true);
      } catch (error) {
        console.error('Failed to load initial metadata:', error);
        setIsAPIAvailable(false);
      }
    };
    
    loadInitialMetadata();
    
    // Cleanup subscription on unmount
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Function to reload metadata from the service
  const reloadMetadataData = async () => {
    try {
      const data = await metadataService.getOptions(true); // Force refresh
      // No need to set state here as the subscription will handle it
      console.log('Metadata reload request sent');
      return data;
    } catch (err) {
      console.error('Error requesting metadata reload:', err);
      return null;
    }
  };

  // Improved validation function with linguistic checks
  const validateFieldName = (fieldName: string): { valid: boolean; error: string } => {
    const trimmedName = fieldName.trim();
    
    // Basic checks (empty, length)
    if (!trimmedName) {
      return { valid: false, error: 'Field name cannot be empty' };
    }
    
    if (trimmedName.length < 4) {
      return { valid: false, error: 'Field name must be at least 4 characters long' };
    }
    
    if (trimmedName.length > 50) {
      return { valid: false, error: 'Field name must be less than 50 characters long' };
    }
    
    // Character checks
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedName)) {
      return { 
        valid: false, 
        error: 'Field name can only contain letters, numbers, underscores and hyphens' 
      };
    }
    
    if (!/^[a-zA-Z]/.test(trimmedName)) {
      return {
        valid: false,
        error: 'Field name must start with a letter'
      };
    }
    
    // Pattern checks for non-word strings
    
    // 1. Check for repetitive characters (like "aaaa", "bbbb")
    const repeatedCharsRegex = /(.)\1{3,}/;
    if (repeatedCharsRegex.test(trimmedName.toLowerCase())) {
      return {
        valid: false,
        error: 'Field name contains too many repeated characters'
      };
    }
    
    // 2. Check for keyboard patterns (like "asdf", "qwerty")
    const keyboardPatterns = ['qwert', 'asdf', 'zxcv', 'uiop', 'hjkl', 'bnm'];
    if (keyboardPatterns.some(pattern => trimmedName.toLowerCase().includes(pattern))) {
      return {
        valid: false,
        error: 'Field name contains keyboard patterns'
      };
    }
    
    // 3. Check vowel presence (most real words have vowels)
    if (!/[aeiouy]/i.test(trimmedName)) {
      return {
        valid: false,
        error: 'Field name should contain at least one vowel'
      };
    }
    
    // 4. Check for alternating consonants and vowels (improves word likelihood)
    let vowelCount = (trimmedName.match(/[aeiouy]/gi) || []).length;
    let consonantCount = (trimmedName.match(/[bcdfghjklmnpqrstvwxz]/gi) || []).length;
    
    // Real words typically have a somewhat balanced ratio of consonants to vowels
    if (trimmedName.length >= 5 && (vowelCount === 0 || consonantCount === 0)) {
      return {
        valid: false,
        error: 'Field name should have a mix of consonants and vowels'
      };
    }
    
    // 5. Check for reserved words
    const reservedWords = ['null', 'undefined', 'nan', 'test', 'temp', 'none', 'asdf', 'qwerty', 'admin', 'user'];
    if (reservedWords.includes(trimmedName.toLowerCase())) {
      return {
        valid: false,
        error: `"${trimmedName}" is a reserved word and cannot be used`
      };
    }
    
    return { valid: true, error: '' };
  };

  // Enhanced word complexity score function with aligned validation rules
  const getWordComplexityScore = (word: string): { score: number; criteria: { [key: string]: boolean }; willBeRejected: boolean } => {
    const criteria: { [key: string]: boolean } = {
      length: word.length >= 4 && word.length <= 50,
      startsWithLetter: /^[a-zA-Z]/.test(word),
      noSpecialChars: /^[a-zA-Z0-9_-]+$/.test(word),
      hasVowels: /[aeiouy]/i.test(word),
      hasConsonants: /[bcdfghjklmnpqrstvwxz]/i.test(word),
      noRepeatedChars: !/(.)\1{3,}/.test(word.toLowerCase()), // Exact same check as validateFieldName
      noKeyboardPatterns: !['qwert', 'asdf', 'zxcv', 'uiop', 'hjkl'].some(pattern => 
        word.toLowerCase().includes(pattern)
      ),
      notReservedWord: !['null', 'undefined', 'nan', 'test', 'temp', 'none'].includes(word.toLowerCase()),
      goodFormat: word.includes('_') || (word.match(/[A-Z]/g) || []).length > 1 // camelCase or snake_case
    };
    
    // Count passed criteria
    const passedCount = Object.values(criteria).filter(Boolean).length;
    
    // Calculate score as percentage of passed criteria
    const score = (passedCount / Object.keys(criteria).length) * 10;
    
    // Check if any CRITICAL criteria will cause rejection
    const willBeRejected = !criteria.length || 
                           !criteria.startsWithLetter || 
                           !criteria.noSpecialChars || 
                           !criteria.noRepeatedChars || 
                           !criteria.noKeyboardPatterns ||
                           !criteria.notReservedWord;
    
    return { score, criteria, willBeRejected };
  };

  // Get quality label based on comprehensive score and rejection status
  const getQualityLabel = (result: { score: number; criteria: { [key: string]: boolean }; willBeRejected: boolean }): string => {
    if (result.willBeRejected) return 'Invalid';
    if (result.score > 8) return 'Good';
    if (result.score > 5) return 'Fair';
    return 'Poor';
  };

  // Get quality class based on comprehensive score and rejection status
  const getQualityClass = (result: { score: number; criteria: { [key: string]: boolean }; willBeRejected: boolean }): string => {
    if (result.willBeRejected) return styles.invalidQuality;
    if (result.score > 8) return styles.goodQuality;
    if (result.score > 5) return styles.mediumQuality;
    return styles.poorQuality;
  };

  // Get rejection reason if any critical criteria fails
  const getRejectionReason = (result: { criteria: { [key: string]: boolean } }): string | null => {
    if (!result.criteria.length) return 'Name must be 4-50 characters';
    if (!result.criteria.startsWithLetter) return 'Must start with a letter';
    if (!result.criteria.noSpecialChars) return 'Only letters, numbers, _ and - allowed';
    if (!result.criteria.noRepeatedChars) return 'Too many repeated characters';
    if (!result.criteria.noKeyboardPatterns) return 'Contains keyboard pattern';
    if (!result.criteria.notReservedWord) return 'Uses a reserved word';
    return null;
  };

  // Get percentage for CSS variable
  const getQualityPercentage = (result: { score: number }): string => {
    return `${result.score * 10}%`;
  };

  // Format field value to follow consistent naming convention
  const formatFieldValue = (value: string): string => {
    // Replace spaces with underscores
    let formatted = value.trim().replace(/\s+/g, '_');
    
    // Make first letter uppercase for categories that follow that pattern
    if (selectedFieldCategory && ['collection', 'thematicFocusPrimary', 'issuingAuthorityType'].includes(selectedFieldCategory)) {
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    
    return formatted;
  };

  // Add a field with validation and formatting - MODIFIED to use the service
  const handleAddField = (e?: React.FormEvent) => {
    console.log("[ManageFieldsComponent] handleAddField called", e?.type);
    
    // Prevent form submission if this is called from a form
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!newFieldValue.trim() || !selectedFieldCategory) return;
    
    // Format according to naming conventions
    const formattedValue = formatFieldValue(newFieldValue);
    
    // Validate the formatted name
    const validation = validateFieldName(formattedValue);
    if (!validation.valid) {
      setNamingError(validation.error);
      return;
    }
    
    setNamingError('');
    setIsSubmitting(true);
    
    // Create a deep copy of the current state
    const updatedOptions = JSON.parse(JSON.stringify(metadataOptions));
    
    if (selectedSubCategory) {
      // For hierarchical fields
      const parentCategory = selectedFieldCategory;
      if (typeof updatedOptions[parentCategory] === 'object' && !Array.isArray(updatedOptions[parentCategory])) {
        const hierarchyObj = updatedOptions[parentCategory] as Record<string, string[]>;
        
        // Check if the field already exists to prevent duplicates
        if (hierarchyObj[selectedSubCategory] && 
            hierarchyObj[selectedSubCategory].includes(formattedValue)) {
          setStatusMessage('This field already exists. Please enter a unique value.');
          setIsSubmitting(false);
          setTimeout(() => setStatusMessage(''), 3000);
          return;
        }
        
        if (hierarchyObj[selectedSubCategory]) {
          hierarchyObj[selectedSubCategory] = [...hierarchyObj[selectedSubCategory], formattedValue];
        } else {
          hierarchyObj[selectedSubCategory] = [formattedValue];
        }
      }
    } else {
      // For simple arrays
      if (Array.isArray(updatedOptions[selectedFieldCategory])) {
        // Check if the field already exists to prevent duplicates
        if ((updatedOptions[selectedFieldCategory] as string[]).includes(formattedValue)) {
          setStatusMessage('This field already exists. Please enter a unique value.');
          setIsSubmitting(false);
          setTimeout(() => setStatusMessage(''), 3000);
          return;
        }
        
        (updatedOptions[selectedFieldCategory] as string[]).push(formattedValue);
      }
    }
    
    // Update local state immediately for UI responsiveness
    setMetadataOptions(updatedOptions);
    
    // Clear the input field immediately
    setNewFieldValue('');
    
    // Store the latest state in ref to use in the saveChanges timeout
    localOptionsRef.current = updatedOptions;
    
    // Debounce the save operation to prevent multiple API calls
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      // Only save if we have data to save
      if (localOptionsRef.current) {
        saveChanges(localOptionsRef.current);
      }
    }, 800); // Debounce for 800ms
    
    // Don't wait for the API call to complete to update UI
    setIsSubmitting(false);
  };

  // Modified handleAddSubCategory - similar changes to handleAddField
  const handleAddSubCategory = (e?: React.FormEvent) => {
    // Prevent form submission if this is called from a form
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!newFieldValue.trim() || !selectedFieldCategory) return;
    
    // Format according to naming conventions
    const formattedValue = formatFieldValue(newFieldValue);
    
    // Validate the formatted name
    const validation = validateFieldName(formattedValue);
    if (!validation.valid) {
      setNamingError(validation.error);
      return;
    }
    
    setNamingError('');
    setIsSubmitting(true);
    
    // Create a deep copy for local updates
    const updatedOptions = JSON.parse(JSON.stringify(metadataOptions));
    const parentCategory = selectedFieldCategory as keyof MetadataOptionsType;
    
    if (typeof updatedOptions[parentCategory] === 'object' && !Array.isArray(updatedOptions[parentCategory])) {
      // Check if subcategory already exists
      const hierarchyObj = updatedOptions[parentCategory] as Record<string, string[]>;
      if (hierarchyObj[formattedValue]) {
        setStatusMessage('This subcategory already exists. Please enter a unique value.');
        setIsSubmitting(false);
        setTimeout(() => setStatusMessage(''), 3000);
        return;
      }
      
      const hierarchyObj2 = updatedOptions[parentCategory] as Record<string, string[]>;
      
      if (!hierarchyObj2[formattedValue]) {
        hierarchyObj2[formattedValue] = [];
      }
      
      // Update local state immediately
      setMetadataOptions(updatedOptions);
      
      // Store for debounced save
      localOptionsRef.current = updatedOptions;
      
      // Debounce the save operation
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        if (localOptionsRef.current) {
          saveChanges(localOptionsRef.current);
        }
      }, 800);
      
      setNewFieldValue('');
      setIsSubmitting(false);
    }
  };

  // Save changes using the service
  const saveChanges = async (optionsToSave: MetadataOptionsType = metadataOptions) => {
    // Prevent multiple simultaneous saves
    if (isSavingRef.current) {
      console.log('Save operation already in progress, skipping');
      return;
    }
    
    setStatusMessage('Saving...');
    isSavingRef.current = true;
    
    try {
      const result = await metadataService.saveOptions(optionsToSave);
      
      setStatusMessage('Fields saved successfully!');
      
      // Only call callback if provided, but don't reload the page
      if (onFieldsSaved) {
        // Use timeout to allow UI to update first
        setTimeout(() => {
          onFieldsSaved();
        }, 300);
      }
    } catch (err) {
      console.error('Error saving:', err);
      setStatusMessage('Error connecting to server. Please try again.');
    } finally {
      isSavingRef.current = false;
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const getFieldsToDisplay = (): string[] => {
    if (selectedSubCategory && selectedFieldCategory) {
      const parentCategory = selectedFieldCategory;
      if (typeof metadataOptions[parentCategory] === 'object' && !Array.isArray(metadataOptions[parentCategory])) {
        const hierarchyObj = metadataOptions[parentCategory] as Record<string, string[]>;
        return hierarchyObj[selectedSubCategory] || [];
      }
    } else if (selectedFieldCategory && Array.isArray(metadataOptions[selectedFieldCategory])) {
      return metadataOptions[selectedFieldCategory] as string[];
    }
    
    return [];
  };

  const getSubCategories = (): string[] => {
    if (!selectedFieldCategory) return [];
    
    const parentCategory = selectedFieldCategory;
    if (typeof metadataOptions[parentCategory] === 'object' && !Array.isArray(metadataOptions[parentCategory])) {
      return Object.keys(metadataOptions[parentCategory] as Record<string, string[]>);
    }
    return [];
  };

  // Check if the current category has subcategories
  const isHierarchicalField = (category?: keyof MetadataOptionsType | null): boolean => {
    const cat = category || selectedFieldCategory;
    return cat !== null && typeof metadataOptions[cat] === 'object' && !Array.isArray(metadataOptions[cat]);
  };

  // Modified function to handle category selection
  const handleCategorySelection = (category: keyof MetadataOptionsType) => {
    // Only update if actually changing categories
    if (category !== selectedFieldCategory) {
      setSelectedFieldCategory(category);
      setNewFieldValue('');
      setNamingError('');
      setSelectedSubCategory(null);
      
      // For non-hierarchical fields, automatically show fields view if needed
      if (!isHierarchicalField(category)) {
        if (onCategorySelected) {
          onCategorySelected(category as string);
        }
        setViewNonHierarchicalFields(true);
      } else {
        setViewNonHierarchicalFields(false);
      }
    }
  };

  // Modified to handle viewing fields for non-hierarchical categories
  const handleViewFields = () => {
    setViewNonHierarchicalFields(true);
  };
  
  // Modified to go back from viewing fields
  const handleBackToCategories = () => {
    setViewNonHierarchicalFields(false);
    setSelectedSubCategory(null);
  };
  
  // Auto-refresh only once when component mounts, not on category changes
  useEffect(() => {
    // Initial load only
    reloadMetadataData();
    
    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array - only run once

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Select A Metadata Category</h2>
      
      {!isAPIAvailable && (
        <div className={styles.apiWarning}>
          <p>⚠️ Warning: Unable to connect to the server. Fields can be added but will not be saved.</p>
        </div>
      )}
      
      <div className={styles.fieldsContainer}>
        {/* Field Category Selection - modified breadcrumb to handle non-hierarchical fields */}
        <div className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>
            {selectedSubCategory && selectedFieldCategory ? (
              <div className={styles.breadcrumb}>
                <span className={styles.breadcrumbCategory} onClick={handleBackToCategories}>
                  {selectedFieldCategory.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </span>
                <span className={styles.breadcrumbSeparator}>›</span>
                <span className={styles.breadcrumbSubcategory}>
                  {selectedSubCategory.replace(/_/g, ' ')}
                </span>
              </div>
            ) : viewNonHierarchicalFields && selectedFieldCategory ? (
              <div className={styles.breadcrumb}>
                <span className={styles.breadcrumbCategory} onClick={handleBackToCategories}>
                  Categories
                </span>
                <span className={styles.breadcrumbSeparator}>›</span>
                <span className={styles.breadcrumbSubcategory}>
                  {selectedFieldCategory.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </span>
              </div>
            ) : (
              ""
            )}
          </h3>
          
          {/* Only show category grid when not viewing specific fields and no category is selected or we're at the top level */}
          {(!selectedFieldCategory || (!selectedSubCategory && !viewNonHierarchicalFields)) && (
            <div className={styles.categoryGrid}>
              {Object.keys(metadataOptions).map((category) => (
                <div 
                  key={category}
                  onClick={() => handleCategorySelection(category as keyof MetadataOptionsType)}
                  className={`${styles.categoryCard} ${selectedFieldCategory === category ? styles.activeCard : ''}`}
                >
                  <div className={styles.categoryIcon}>
                    {category.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.categoryLabel}>
                    {category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </div>
                  <div className={styles.categoryCount}>
                    {Array.isArray(metadataOptions[category as keyof MetadataOptionsType]) 
                      ? (metadataOptions[category as keyof MetadataOptionsType] as string[]).length
                      : Object.keys(metadataOptions[category as keyof MetadataOptionsType] as Record<string, string[]>).length
                    } items
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Sub-Category Selection - Only show for hierarchical fields */}
        {selectedFieldCategory && isHierarchicalField() && !selectedSubCategory && !viewNonHierarchicalFields && (
          <div className={styles.sectionCard}>
            <div className={styles.subCategoryHeader}>
              <h3 className={styles.sectionTitle}>Sub-Categories</h3>
            </div>
            
            <div className={styles.subCategoryGrid}>
              {/* Show subcategories */}
              {getSubCategories().map((subCategory) => (
                <div
                  key={subCategory}
                  onClick={() => {
                    setSelectedSubCategory(subCategory);
                    setNewFieldValue('');
                    setNamingError('');
                  }}
                  className={styles.subCategoryCard}
                >
                  <div className={styles.subCategoryName}>
                    {subCategory.replace(/_/g, ' ')}
                  </div>
                  <div className={styles.subCategoryCount}>
                    {((metadataOptions[selectedFieldCategory] as Record<string, string[]>)[subCategory] || []).length} items
                  </div>
                  <div className={styles.viewButton}>View Fields</div>
                </div>
              ))}
              
              {/* Add New Sub-Category */}
              <div className={styles.addSubCategoryCard}>
                <div className={styles.formHeader}>
                  <h4>New Sub-Category</h4>
                  <button 
                    className={styles.helpIcon} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowNamingGuide(!showNamingGuide);
                    }}
                    aria-label="Show naming guidelines"
                  >
                    ?
                  </button>
                </div>
                
                {/* Naming guide and form */}
                {showNamingGuide && (
                  <div className={styles.namingGuide}>
                    <h5>Naming Guidelines:</h5>
                    <ul>
                      <li>Names must be at least 4 characters long</li>
                      <li>Names must start with a letter</li>
                      <li>Only letters, numbers, underscores and hyphens are allowed</li>
                      <li>Spaces will be converted to underscores</li>
                      <li>Names should be meaningful words or combinations</li>
                      <li>Include both vowels and consonants</li>
                      <li>Avoid patterns like "asdf" or repeated characters</li>
                      <li>Maximum length is 50 characters</li>
                    </ul>
                  </div>
                )}
                
                <form className={styles.inputRow} onSubmit={handleAddSubCategory}>
                  <input
                    type="text"
                    placeholder="Sub-Category Name"
                    value={newFieldValue}
                    onChange={(e) => setNewFieldValue(e.target.value)}
                    className={`${styles.input} ${namingError ? styles.inputError : ''}`}
                    disabled={isSubmitting}
                  />
                  
                  {newFieldValue && (
                    <div className={styles.previewValue}>
                      <span>Preview: </span>
                      <code>{formatFieldValue(newFieldValue)}</code>
                    </div>
                  )}
                
                  {namingError && <div className={styles.errorMessage}>{namingError}</div>}
                
                  <button
                    type="submit"
                    className={styles.addButton}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Adding...' : 'Add Sub-Category'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
        
        {/* Field Management UI - Show for selected subcategory or when viewing non-hierarchical fields */}
        {(selectedSubCategory || (selectedFieldCategory && viewNonHierarchicalFields)) && (
          <div className={styles.sectionCard}>
            <div className={styles.fieldListContainer}>
              {/* Field listing with count banner */}
              <div className={styles.fieldsHeader}>
                <h3 className={styles.fieldsTitle}>
                  {getFieldsToDisplay().length} {getFieldsToDisplay().length === 1 ? 'Field' : 'Fields'}
                </h3>
              </div>
              
              <div className={styles.fieldList}>
                {getFieldsToDisplay().length > 0 ? (
                  getFieldsToDisplay().map((field, index) => (
                    <div key={index} className={styles.fieldItem}>
                      <span className={styles.fieldValue}>{field.replace(/_/g, ' ')}</span>
                      <span className={styles.fieldCode}>{field}</span>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyMessage}>
                    <div className={styles.emptyIcon}>📝</div>
                    <div className={styles.emptyText}>No fields found. Add some fields below.</div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Add Field Form - with improved UI - MODIFIED with form element */}
            <form 
              ref={formRef} 
              className={styles.fieldForm} 
              onSubmit={(e) => {
                console.log("[ManageFieldsComponent] Form submit event triggered");
                e.preventDefault();
                e.stopPropagation();
                handleAddField(e);
                return false; // Ensure no navigation
              }}
            >
              <div className={styles.formHeader}>
                <h4 className={styles.formTitle}>Add New Field</h4>
                <button 
                  type="button" // Add type="button" to prevent form submission
                  className={styles.helpIcon} 
                  onClick={() => setShowNamingGuide(!showNamingGuide)}
                  aria-label="Show naming guidelines"
                >
                  ?
                </button>
              </div>
              
              {showNamingGuide && (
                <div className={styles.namingGuide}>
                  <h5>Naming Guidelines:</h5>
                  <ul>
                    <li>Names must be at least 4 characters long</li>
                    <li>Names must start with a letter</li>
                    <li>Only letters, numbers, underscores and hyphens are allowed</li>
                    <li>Spaces will be converted to underscores</li>
                    <li>Names should be meaningful words or combinations</li>
                    <li>Include both vowels and consonants</li>
                    <li>Avoid patterns like "asdf" or repeated characters</li>
                    <li>Maximum length is 50 characters</li>
                  </ul>
                </div>
              )}
              
              <div className={styles.inputRow}>
                <input
                  type="text"
                  placeholder="Enter field name"
                  value={newFieldValue}
                  onChange={(e) => setNewFieldValue(e.target.value)}
                  className={`${styles.input} ${namingError ? styles.inputError : ''}`}
                  disabled={isSubmitting}
                />
                
                {newFieldValue && (
                  <div className={styles.previewValue}>
                    <span>Preview: </span>
                    <code>{formatFieldValue(newFieldValue)}</code>
                    
                    {/* Only show quality indicator when we have at least 2 characters */}
                    {newFieldValue.length >= 2 && (
                      <>
                        {(() => {
                          const formattedValue = formatFieldValue(newFieldValue);
                          const result = getWordComplexityScore(formattedValue);
                          const qualityClass = getQualityClass(result);
                          const rejectionReason = getRejectionReason(result);
                          
                          return (
                            <div className={styles.qualityIndicator}>
                              <div className={styles.qualityLabel}>
                                <span>Name Quality:</span>
                                <span className={`${styles.qualityValue} ${qualityClass}`}>
                                  {getQualityLabel(result)}
                                </span>
                              </div>
                              
                              {rejectionReason && (
                                <div className={styles.validationWarning}>
                                  ⚠️ {rejectionReason}
                                </div>
                              )}
                              
                              <div className={styles.qualityCriteria}>
                                {Object.entries(result.criteria).map(([key, passed]) => (
                                  <span key={key} className={`${styles.criteriaTag} ${passed ? styles.passed : styles.failed}`}>
                                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                  </span>
                                ))}
                              </div>
                              
                              <div className={styles.qualityMeter}>
                                <div 
                                  className={`${styles.qualityMeterFill} ${qualityClass}`} 
                                  style={{ '--quality-score': getQualityPercentage(result) } as React.CSSProperties}
                                >
                                  <div className={styles.qualityMeterTicks}>
                                    {[...Array(9)].map((_, i) => (
                                      <div key={i} className={styles.qualityMeterTick} />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {namingError && <div className={styles.errorMessage}>{namingError}</div>}
              
              <button
                type="button" // Explicitly set button type to prevent default form submission
                className={styles.addButton}
                disabled={isSubmitting}
                onClick={(e) => {
                  console.log("[ManageFieldsComponent] Add button clicked");
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddField();
                }}
              >
                {isSubmitting ? 'Adding...' : 'Add Field'}
              </button>
            </form>
          </div>
        )}
        
        {/* Info message about field addition only */}
        <div className={styles.infoMessage}>
          <p><strong>Note:</strong> Fields cannot be deleted or edited once added to preserve metadata integrity. 
          Please ensure field names follow proper conventions before adding them.</p>
        </div>
        
        {/* Status Message */}
        {statusMessage && (
          <div className={`${styles.statusMessage} ${statusMessage.includes('Error') ? styles.errorStatus : styles.successStatus}`}>
            {statusMessage}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageFieldsComponent;
