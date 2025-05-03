import React, { useState, useEffect, useRef } from 'react';
import styles from './MetadataFilterBar.module.css';
import { motion, AnimatePresence } from 'framer-motion'; // Add framer-motion for animations
import { 
  FaBook, FaLayerGroup, FaLanguage, FaTags, FaLock, 
  FaFile, FaGlobe, FaBalanceScale, FaCopyright, 
  FaFolderOpen, FaChevronDown, FaChevronRight,
  FaBuilding, FaRegFileCode, FaCodeBranch, FaRocket, 
  FaCalendarAlt, FaSearch, FaTimes, FaFilter
} from 'react-icons/fa';

// Define the metadata options type to support hierarchy
interface MetadataOptionsType {
  [key: string]: string[] | Record<string, string[]>;
}

// Props for the component
interface MetadataFilterBarProps {
  onTagSelect: (category: string, tag: string) => void;
  selectedTags: { category: string, tag: string }[];
  isMetadataFilterMode?: boolean;
  onToggleFilterMode?: () => void;
}

// Updated metadata options based on the new structure from MetadataModal
const defaultMetadataOptions: MetadataOptionsType = {
  // Collections
  collection: [
    "Constitutional_Development", 
    "Truth_and_Reconciliation_Commission", 
    "Judicial_History", 
    "Public_Participation", 
    "Pre-Apartheid_Legal_Systems", 
    "Post-Apartheid_Governance", 
    "Legislative_and_Justice_System_Records"
  ],
  
  // Jurisdictions
  jurisdictionType: [
    "National", 
    "Provincial", 
    "Traditional_Authorities", 
    "International"
  ],
  
  // Use the hierarchical structure for jurisdictionName
  jurisdictionName: {
    National: ["South_Africa"],
    Provincial: [
        "Gauteng", "KZN", "Eastern_Cape", "Western_Cape", 
        "Limpopo", "Mpumalanga", "Free_State", "Northern_Cape", "North_West"
    ],
    Traditional_Authorities: ["Khoisan_Communities", "Zulu_Kingdom"],
    International: ["United_Nations"]
  },
  
  // Thematic Focus - Split into primary and subthemes
  thematicFocusPrimary: [
    "Human_Rights", 
    "Land_Reform", 
    "Transitional_Justice", 
    "Constitutional_Drafting", 
    "Security_Laws"
  ],
  
  // Hierarchical subthemes based on primary theme
  thematicFocusSubthemes: {
    Human_Rights: ["Bill_of_Rights", "Socio-Economic_Rights", "LGBTQ+_Protections"],
    Land_Reform: ["Expropriation", "Restitution", "Section_25"],
    Transitional_Justice: ["TRC_Testimonies", "Amnesty_Hearings", "Reparations"],
    Constitutional_Drafting: ["Multi-Party_Negotiations", "Public_Consultations", "Finalization_Stages"],
    Security_Laws: ["RICA", "State_Surveillance"]
  },
  
  // Issuing Authority - Split for filtering
  issuingAuthorityType: [
    "Political_Parties", "Government_Bodies", "Independent_Commissions", 
    "Civil_Society_Organizations", "Individuals"
  ],
  issuingAuthorityName: { // Keep hierarchical for potential future use, flatten for now
    Political_Parties: ["ANC", "DA", "EFF", "IFP", "NFP"],
    Government_Bodies: ["Constitutional_Court", "Parliament", "Department_of_Justice", "Department_of_Land_Affairs"],
    Independent_Commissions: ["TRC", "Electoral_Commission", "Human_Rights_Commission", "Public_Protector_Office"],
    Civil_Society_Organizations: ["COSATU", "Section27", "Law_Review_Project", "Legal_Resource_Centre"],
    Individuals: ["Albie_Sachs", "Desmond_Tutu", "Nelson_Mandela", "Dullah_Omar"]
  },
  
  // Document Function
  documentFunction: [
    "bill-draft", "legal-revision", "public-submission", "consultation-record", 
    "parliamentary-debate", "commission-report", "government-gazette", 
    "amendment-bill", "official-translation", "Court_Judgement", 
    "Treaty_Agreement", "Act", "Research_Paper"
  ],
  
  // Version
  version: [
    "v0_Preliminary", "v1_internal_review", "v2_Public_Feedback", 
    "v3_Revised_Draft", "v4_Final_Draft"
  ],
  
  // Workflow Stage - Split for filtering
  workflowStagePrimary: [
    "Creation", "Approval", "Post-Approval"
  ],
  workflowStageSub: { // Keep hierarchical, flatten for filter bar display
    Creation: ["Draft", "Submitted", "Under_Review", "public-comment", "committee-debate"],
    Approval: ["Committee_Approved", "Certified", "Enacted"],
    Post_Approval: ["Archived", "Repealed", "Superseded"]
  },
  
  // Legacy fields
  language: ["en", "fr", "af", "zu", "xh", "ts", "st", "ve", "tn", "ss", "nr", "nso"],
  accessLevel: ["public", "restricted", "admin-only"],
  fileType: ["pdf", "docx", "txt", "jpeg", "png", "mp3", "mp4", "wav", "avi"],
  license: ["Creative Commons BY-SA", "Creative Commons BY-NC", "Public Domain", "Government Copyright", "All Rights Reserved"],
  tags: [] // Assuming general tags are managed separately or added dynamically
};

// Updated category metadata for UI presentation
const categoryMetadata = [
  { id: 'collection', label: 'Collection', icon: <FaFolderOpen /> },
  { id: 'jurisdictionType', label: 'Jurisdiction Type', icon: <FaGlobe /> },
  { id: 'jurisdictionName', label: 'Jurisdiction Name', icon: <FaGlobe /> }, // Keep separate for filtering
  { id: 'thematicFocusPrimary', label: 'Primary Theme', icon: <FaBook /> },
  { id: 'thematicFocusSubthemes', label: 'Subtheme', icon: <FaBook /> }, // Keep separate for filtering
  // Update Issuing Authority
  { id: 'issuingAuthorityType', label: 'Authority Type', icon: <FaBuilding /> },
  { id: 'issuingAuthorityName', label: 'Authority Name', icon: <FaBuilding /> },
  { id: 'documentFunction', label: 'Document Function', icon: <FaRegFileCode /> },
  { id: 'version', label: 'Version', icon: <FaCodeBranch /> },
  // Update Workflow Stage
  { id: 'workflowStagePrimary', label: 'Workflow Stage', icon: <FaRocket /> },
  { id: 'workflowStageSub', label: 'Workflow Sub-Stage', icon: <FaRocket /> },
  { id: 'fileType', label: 'File Type', icon: <FaFile /> },
  { id: 'language', label: 'Language', icon: <FaLanguage /> },
  { id: 'accessLevel', label: 'Access Level', icon: <FaLock /> },
  { id: 'license', label: 'License', icon: <FaCopyright /> },
  { id: 'tags', label: 'Tags', icon: <FaTags /> } // General tags
];

const MetadataFilterBar: React.FC<MetadataFilterBarProps> = ({ 
  onTagSelect, 
  selectedTags,
  isMetadataFilterMode = false,
  onToggleFilterMode
}) => {
  // State for managing the metadata options (loaded from default for now)
  const [metadataOptions, setMetadataOptions] = useState<MetadataOptionsType>(defaultMetadataOptions);
  
  // State for managing expanded categories
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  
  // Add new state for search functionality
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<{categoryId: string, tags: string[]}[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Add state for filter counts
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({});
  
  // Track pre-search expanded state to restore after clearing search
  const [preSearchExpandedState, setPreSearchExpandedState] = useState<string[]>([]);
  
  // Helper to check if a category is hierarchical
  const isHierarchical = (categoryId: string): boolean => {
    // Check if the entry in defaultMetadataOptions exists and is an object but not an array
    const options = defaultMetadataOptions[categoryId];
    return typeof options === 'object' && options !== null && !Array.isArray(options);
  };

  // Toggle a category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Handle tag click
  const handleTagClick = (category: string, tag: string) => {
    if (onTagSelect) {
      onTagSelect(category, tag);
    }
  };

  // Check if a tag is selected
  const isTagSelected = (category: string, tag: string) => {
    return selectedTags.some(item => item.category === category && item.tag === tag);
  };

  // Helper to get all available tags for a category, handling hierarchical data
  const getTagsForCategory = (categoryId: string): string[] => {
    const options = metadataOptions[categoryId];
    if (Array.isArray(options)) {
      return options;
    } else if (typeof options === 'object' && options !== null) {
      // For hierarchical data, flatten the values for the filter bar
      return Object.values(options).flat().filter(tag => typeof tag === 'string') as string[];
    }
    return [];
  };

  // Add search functionality
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const term = event.target.value.toLowerCase();
    
    // Store the current expanded state when starting a search
    if (!searchTerm && term.trim()) {
      setPreSearchExpandedState(expandedCategories);
    }
    
    setSearchTerm(term);
    
    if (!term.trim()) {
      setSearchResults([]);
      // Restore the pre-search expanded state when clearing
      setExpandedCategories(preSearchExpandedState);
      return;
    }
    
    // Search all categories and tags
    const results = categoryMetadata.map(category => {
      const tagsForCategory = getTagsForCategory(category.id);
      const matchingTags = tagsForCategory.filter(tag => 
        tag.toLowerCase().replace(/_/g, ' ').includes(term)
      );
      
      return {
        categoryId: category.id,
        tags: matchingTags
      };
    }).filter(result => result.tags.length > 0);
    
    setSearchResults(results);
    
    // If we have search results, expand only those categories
    if (results.length > 0) {
      const categoriesToExpand = results.map(r => r.categoryId);
      setExpandedCategories(categoriesToExpand); // Replace instead of merging
    }
  };
  
  const clearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    // Restore the pre-search expanded state
    setExpandedCategories(preSearchExpandedState);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };
  
  // Update filter counts when selectedTags changes
  useEffect(() => {
    const counts: Record<string, number> = {};
    
    selectedTags.forEach(({ category }) => {
      counts[category] = (counts[category] || 0) + 1;
    });
    
    setFilterCounts(counts);
  }, [selectedTags]);
  
  // Helper to get the category label by id
  const getCategoryLabel = (categoryId: string): string => {
    const category = categoryMetadata.find(c => c.id === categoryId);
    return category ? category.label : categoryId;
  };
  
  // Add a function to render active filters at the top
  const renderActiveFilters = () => {
    if (selectedTags.length === 0) return null;
    
    return (
      <div className={styles.activeFiltersSection}>
        <div className={styles.activeFiltersHeader}>
          <FaFilter />
          <span>Active Filters</span>
          <button 
            className={styles.clearAllButton}
            onClick={() => selectedTags.forEach(tag => 
              handleTagClick(tag.category, tag.tag)
            )}
          >
            Clear All
          </button>
        </div>
        
        <div className={styles.activeFiltersList}>
          {Object.entries(filterCounts).map(([category, count]) => (
            <div 
              key={category}
              className={styles.activeFilterCategory}
            >
              <div className={styles.categoryBadge}>
                <span>{getCategoryLabel(category)}</span>
                <span className={styles.categoryCount}>{count}</span>
              </div>
              <div className={styles.categoryTags}>
                {selectedTags
                  .filter(tag => tag.category === category)
                  .map(tag => (
                    <div 
                      key={`${tag.category}-${tag.tag}`}
                      className={styles.activeFilterTag}
                      onClick={() => handleTagClick(tag.category, tag.tag)}
                    >
                      {tag.tag.replace(/_/g, ' ')}
                      <FaTimes className={styles.removeTagIcon} />
                    </div>
                  ))
                }
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Highlight matching text in search results
  const highlightMatch = (text: string, term: string) => {
    if (!term.trim()) return text.replace(/_/g, ' ');
    
    const regex = new RegExp(`(${term})`, 'gi');
    const parts = text.replace(/_/g, ' ').split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  };
  
  // Add helpers to distinguish between directory structure and metadata-only filters
  const isDirectoryStructureCategory = (categoryId: string): boolean => {
    return [
      'collection', 'jurisdictionName', 'thematicFocusPrimary', 
      'issuingAuthorityName', 'documentFunction', 'version', 'workflowStagePrimary'
    ].includes(categoryId);
  };

  // Enhanced render method for empty state when filtering
  const renderEmptyFilterResults = () => {
    // Only show if we have active filters
    if (selectedTags.length === 0) return null;
    
    return (
      <div className={styles.emptyFilterResults}>
        <div className={styles.emptyFilterIcon}>
          <FaFilter size={36} />
        </div>
        <h3>No matching files</h3>
        <p>None of the files match all selected filter criteria.</p>
        <p>Try using fewer filters or different combinations.</p>
        <button
          className={styles.clearAllFiltersButton}
          onClick={() => selectedTags.forEach(tag => handleTagClick(tag.category, tag.tag))}
        >
          Clear All Filters
        </button>
      </div>
    );
  };

  return (
    <div className={styles.filterSidebar}>
      <div className={styles.filterHeader}>
        <h3>Filter Files</h3>
        
        {/* Add toggle for deep metadata search */}
        {onToggleFilterMode && (
          <div className={styles.deepSearchToggle}>
            <label>
              <input 
                type="checkbox" 
                checked={isMetadataFilterMode} 
                onChange={onToggleFilterMode}
              />
              Deep Metadata Search
            </label>
            <small>Search across all directories</small>
          </div>
        )}
      </div>
      
      {/* Metadata search mode explanation */}
      {isMetadataFilterMode && (
        <div className={styles.searchModeExplanation}>
          <p>Searching across all files. Select tags to find matching files regardless of their location.</p>
        </div>
      )}
      
      <div className={styles.sidebarHeader}>
        <h3 className={styles.sidebarTitle}>Metadata Filters</h3>
        
        {/* Search input with black text */}
        <div className={styles.searchContainer}>
          <FaSearch className={styles.searchIcon} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search filters..."
            value={searchTerm}
            onChange={handleSearch}
            className={styles.searchInput}
            style={{ color: '#000' }} /* Force black text */
          />
          {searchTerm && (
            <button 
              className={styles.clearSearchButton}
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <FaTimes />
            </button>
          )}
        </div>
      </div>
      
      {/* Render active filters section */}
      {renderActiveFilters()}
      
      {/* Show search results if searching */}
      {searchTerm && searchResults.length > 0 && (
        <motion.div 
          className={styles.searchResults}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className={styles.searchResultsHeader}>
            Search Results
          </div>
          
          {searchResults.map(result => (
            <div key={result.categoryId} className={styles.searchResultCategory}>
              <div className={styles.searchResultCategoryHeader}>
                {getCategoryLabel(result.categoryId)}
              </div>
              <div className={styles.searchResultTags}>
                {result.tags.map(tag => (
                  <motion.div
                    key={`${result.categoryId}-${tag}`}
                    className={`${styles.tagItem} ${isTagSelected(result.categoryId, tag) ? styles.selected : ''}`}
                    onClick={() => handleTagClick(result.categoryId, tag)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className={styles.tagText}>
                      {highlightMatch(tag, searchTerm)}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      )}
      
      {/* Show no results message */}
      {searchTerm && searchResults.length === 0 && (
        <div className={styles.noSearchResults}>
          No matching filters found for "{searchTerm}"
        </div>
      )}
      
      {/* Only show categories if not searching or if search is empty */}
      {(!searchTerm) && (
        <div className={styles.categoriesContainer}>
          {categoryMetadata.map(category => {
            const tagsForCategory = getTagsForCategory(category.id);
            const activeTags = selectedTags.filter(t => t.category === category.id).length;
            const isDirectoryCategory = isDirectoryStructureCategory(category.id);
            
            return (
              <motion.div 
                key={category.id} 
                className={`${styles.categorySection} ${isDirectoryCategory ? styles.directoryCategory : styles.metadataCategory}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div 
                  className={`${styles.categoryHeader} ${activeTags > 0 ? styles.activeCategory : ''}`}
                  onClick={() => toggleCategory(category.id)}
                >
                  <span className={styles.categoryIcon}>{category.icon}</span>
                  <span className={styles.categoryLabel}>
                    {category.label}
                    {isDirectoryCategory && (
                      <span className={styles.directoryBadge} title="Navigation filter">🧭</span>
                    )}
                    {activeTags > 0 && (
                      <span className={styles.activeBadge}>{activeTags}</span>
                    )}
                  </span>
                  <span className={styles.expandIcon}>
                    {expandedCategories.includes(category.id) ? <FaChevronDown /> : <FaChevronRight />}
                  </span>
                </div>
                
                <AnimatePresence>
                  {expandedCategories.includes(category.id) && (
                    <motion.div 
                      className={styles.tagsContainer}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ 
                        maxHeight: '300px', 
                        overflowY: 'auto',
                        overflowX: 'hidden'
                      }}
                    >
                      {tagsForCategory.map((tag) => ( 
                        <motion.div 
                          key={`${category.id}-${tag}`} 
                          className={`${styles.tagItem} ${isTagSelected(category.id, tag) ? styles.selected : ''}`}
                          onClick={() => handleTagClick(category.id, tag)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <span className={styles.tagText}>{tag.replace(/_/g, ' ')}</span>
                        </motion.div>
                      ))}
                      {tagsForCategory.length === 0 && (
                        <div className={styles.emptyTagsMessage}>
                          No {category.label.toLowerCase()} options defined.
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MetadataFilterBar;
