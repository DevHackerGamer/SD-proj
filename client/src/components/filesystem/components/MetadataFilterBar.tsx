import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from './MetadataFilterBar.module.css';
import { motion, AnimatePresence } from 'framer-motion'; 
import { 
  FaBook, FaLayerGroup, FaLanguage, FaTags, FaLock, 
  FaFile, FaGlobe, FaBalanceScale, FaCopyright, 
  FaFolderOpen, FaChevronDown, FaChevronRight, FaChevronUp,
  FaBuilding, FaRegFileCode, FaCodeBranch, FaRocket, 
  FaCalendarAlt, FaSearch, FaTimes, FaFilter, FaSlidersH
} from 'react-icons/fa';

// Import the metadata options directly from JSON file
import metadataOptionsData from '../../../components/managefields/metadataOptions.json';

// Import the new component
import FilterLogicSelector from './FilterLogicSelector';

// Define the metadata options type to support hierarchy
interface MetadataOptionsType {
  [key: string]: string[] | Record<string, string[]>;
}

// Remove match threshold from props
interface MetadataFilterBarProps {
  onTagSelect: (category: string, tag: string) => void;
  selectedTags: { category: string, tag: string }[];
  isMetadataFilterMode?: boolean;
  onToggleFilterMode?: () => void;
  onClearFilters?: () => void;
  filterLogic?: 'AND' | 'OR';
  onFilterLogicChange?: (logic: 'AND' | 'OR') => void;
  // Add new props for controlling expanded sections
  expandedSections?: string[];
  onSectionToggle?: (section: string) => void;
}

// Initialize directly with the JSON data
const defaultMetadataOptions: MetadataOptionsType = metadataOptionsData as MetadataOptionsType;

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
  onToggleFilterMode,
  onClearFilters,
  filterLogic = 'AND',
  onFilterLogicChange,
  // Add new props with defaults
  expandedSections = [],
  onSectionToggle = () => {}
}) => {
  // State for managing the metadata options - set DIRECTLY from the imported JSON
  const [metadataOptions] = useState<MetadataOptionsType>(defaultMetadataOptions);
  
  // Remove loading states since we're not fetching from API
  // const [isLoadingOptions, setIsLoadingOptions] = useState<boolean>(false);
  // const [loadError, setLoadError] = useState<string | null>(null);
  
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
  
  // Add a reference to the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Add a function to scroll to top
  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // Add state to track if we're scrolled down enough to show the button
  const [showScrollTopButton, setShowScrollTopButton] = useState(false);

  // Add a scroll event handler to track scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollTop } = scrollContainerRef.current;
        setShowScrollTopButton(scrollTop > 200);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Add a function to check if content is fully visible
  useEffect(() => {
    // Check if scrollable content overflows after component mounts
    const checkScrollOverflow = () => {
      if (scrollContainerRef.current) {
        const { scrollHeight, clientHeight } = scrollContainerRef.current;
        if (scrollHeight > clientHeight) {
          // If content overflows, show the scroll button even initially
          setShowScrollTopButton(true);
          // Apply classes to ensure proper scrolling 
          scrollContainerRef.current.classList.add(styles.hasOverflow);
        }
      }
    };

    // Run on mount and window resize
    checkScrollOverflow();
    window.addEventListener('resize', checkScrollOverflow);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkScrollOverflow);
  }, []);

  // Update the scroll event handler to also check scroll position bottom
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        
        // Show button when scrolled down OR when content overflows
        setShowScrollTopButton(scrollTop > 100 || scrollHeight > clientHeight);
        
        // Check if we're near the bottom
        const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50;
        if (isNearBottom) {
          // We could add visual feedback here
          console.log("Near bottom of filter list");
        }
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

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

  // Enhanced function to normalize strings for comparison (handles underscores vs spaces)
  const normalizeString = (str: string): string => {
    return str.toLowerCase()
      .replace(/_/g, ' ')  // Replace underscores with spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim();
  };

  // Improved tag matching function
  const isTagSelected = (category: string, tag: string) => {
    const normalizedTag = normalizeString(tag);
    return selectedTags.some(item => {
      const itemCategory = normalizeString(item.category);
      const itemTag = normalizeString(item.tag);
      
      // Direct category match
      if (normalizeString(category) === itemCategory) {
        return normalizedTag === itemTag;
      }
      
      // Handle mappings for special cases (nested structure)
      if (category === 'issuingAuthorityType' && itemCategory === 'issuingauthority_type') {
        return normalizedTag === itemTag;
      }
      
      if (category === 'issuingAuthorityName' && itemCategory === 'issuingauthority_name') {
        return normalizedTag === itemTag;
      }
      
      if (category === 'workflowStagePrimary' && itemCategory === 'workflowstage_primary') {
        return normalizedTag === itemTag;
      }
      
      if (category === 'workflowStageSub' && itemCategory === 'workflowstage_sub') {
        return normalizedTag === itemTag;
      }
      
      if (category === 'thematicFocusPrimary' && itemCategory === 'thematicfocus_primary') {
        return normalizedTag === itemTag;
      }
      
      if (category === 'thematicFocusSubthemes' && itemCategory === 'thematicfocus_subthemes') {
        return normalizedTag === itemTag;
      }
      
      return false;
    });
  };

  // Improved tag click handler to normalize category mapping
  const handleTagClick = (category: string, tag: string) => {
    if (onTagSelect) {
      // Map the UI category to the server-side expected category
      let serverCategory = category;
      
      // Handle mappings for special cases (nested structure)
      if (category === 'issuingAuthorityType') {
        serverCategory = 'issuingauthority_type';
      } else if (category === 'issuingAuthorityName') {
        serverCategory = 'issuingauthority_name';
      } else if (category === 'workflowStagePrimary') {
        serverCategory = 'workflowstage_primary';
      } else if (category === 'workflowStageSub') {
        serverCategory = 'workflowstage_sub';
      } else if (category === 'thematicFocusPrimary') {
        serverCategory = 'thematicfocus_primary';
      } else if (category === 'thematicFocusSubthemes') {
        serverCategory = 'thematicfocus_subthemes';
      } else if (category === 'jurisdictionType') {
        serverCategory = 'jurisdiction_type';
      } else if (category === 'jurisdictionName') {
        serverCategory = 'jurisdiction_name';
      } else if (category === 'documentFunction') {
        serverCategory = 'documentfunction';
      }
      
      console.log(`[Filter] Mapping UI category "${category}" to server category "${serverCategory}"`);
      onTagSelect(serverCategory, tag);
    }
  };

  // Helper to get all available tags for a category, handling hierarchical data
  const getTagsForCategory = (categoryId: string): string[] => {
    const options = metadataOptions[categoryId];
    if (Array.isArray(options)) {
      return options;
    } else if (typeof options === 'object' && options !== null) {
      // For hierarchical data, flatten the values for the filter bar
      return Object.values(options).flat().filter((tag): tag is string => typeof tag === 'string');
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
    
    // Search all categories and tags with normalized comparison
    const results = categoryMetadata.map(category => {
      const tagsForCategory = getTagsForCategory(category.id);
      const matchingTags = tagsForCategory.filter((tag: string) => 
        normalizeString(tag).includes(normalizeString(term))
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
      searchInputRef.current.focus(); // Fixed typo: was searchInputRefRef
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
            onClick={() => {
              // Call the onClearFilters prop if provided
              if (onClearFilters) {
                onClearFilters();
              } else {
                // Fall back to the previous behavior
                selectedTags.forEach(tag => 
                  handleTagClick(tag.category, tag.tag)
                );
              }
            }}
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
          onClick={() => {
            if (onClearFilters) {
              onClearFilters();
            } else {
              selectedTags.forEach(tag => handleTagClick(tag.category, tag.tag));
            }
          }}
        >
          Clear All Filters
        </button>
      </div>
    );
  };

  // Log metadata to help debug
  useEffect(() => {
    console.log('Using metadata options from JSON file:', metadataOptionsData);
    // Log specific categories to check if they have data
    console.log('Collections:', metadataOptionsData.collection);
    console.log('Document Functions:', metadataOptionsData.documentFunction);
    
    const categoryCounts = Object.entries(metadataOptions).reduce((acc, [key, value]) => {
      const count = Array.isArray(value) 
        ? value.length 
        : Object.values(value as Record<string, string[]>).flat().length;
      return { ...acc, [key]: count };
    }, {});
    
    console.log('Metadata option counts:', categoryCounts);
  }, []);

  // Add state to track if a tag container needs scrolling
  const [tagContainersWithOverflow, setTagContainersWithOverflow] = useState<Record<string, boolean>>({});
  
  // Ref to track tag containers for overflow detection
  const tagContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Check for tag container overflow when expanded categories change
  useEffect(() => {
    // Wait for animation to complete
    const timer = setTimeout(() => {
      const newOverflowState: Record<string, boolean> = {};
      
      expandedCategories.forEach(categoryId => {
        const container = tagContainerRefs.current[categoryId];
        if (container) {
          newOverflowState[categoryId] = container.scrollHeight > container.clientHeight;
        }
      });
      
      setTagContainersWithOverflow(newOverflowState);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [expandedCategories]);

  // Replace the toggleSection function to use the parent callback
  const toggleSection = (section: string) => {
    onSectionToggle(section);
  };
  
  // Use the expandedSections prop to determine if a section is expanded
  const isSectionExpanded = (section: string) => {
    return expandedSections.includes(section);
  };

  // Update the return JSX to wrap categoriesContainer in a scrollView
  return (
    <div className={styles.filterSidebar}>
      {/* Compact header with title and search combined */}
      <div className={styles.filterHeader}>
        <h3 className={styles.filterTitle}>Metadata Filters</h3>
        
        {/* Move search input closer to title */}
        <div className={styles.searchContainer}>
          <FaSearch className={styles.searchIcon} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search filters..."
            value={searchTerm}
            onChange={handleSearch}
            className={styles.searchInput}
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
      
      {/* Add this inside your MetadataFilterBar component, just below the header */}
      <div className={styles.filterControls}>
        {selectedTags.length > 0 && (
          <FilterLogicSelector 
            filterLogic={filterLogic}
            onChange={(logic: 'AND' | 'OR') => {
              if (onFilterLogicChange) {
                onFilterLogicChange(logic);
              }
            }}
            disabled={selectedTags.length <= 1}
          />
        )}
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
      
      {/* Only show categories if not searching or if search is empty - NOW WITH SCROLL CONTAINER */}
      {(!searchTerm) && (
        <div className={styles.categoriesScrollView} ref={scrollContainerRef}>
          <div className={styles.categoriesContainer}>
            {categoryMetadata.map(category => {
              const tagsForCategory = getTagsForCategory(category.id);
              const activeTags = selectedTags.filter(t => t.category === category.id).length;
              const isDirectoryCategory = isDirectoryStructureCategory(category.id);
              const hasOverflow = tagContainersWithOverflow[category.id];
              
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
                    onClick={() => toggleSection(category.id)}
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
                      {isSectionExpanded(category.id) ? <FaChevronDown /> : <FaChevronRight />}
                    </span>
                  </div>
                  
                  <AnimatePresence>
                    {isSectionExpanded(category.id) && (
                      <motion.div 
                        className={styles.tagsContainer}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ 
                          opacity: 1, 
                          height: 'auto', 
                          maxHeight: '300px' 
                        }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {tagsForCategory.length > 0 ? (
                          <div 
                            className={`${styles.tagItems} ${hasOverflow ? styles.hasScrollIndicator : ''}`}
                            ref={(el: HTMLDivElement | null) => {
                              tagContainerRefs.current[category.id] = el;
                            }}
                          >
                            {tagsForCategory.map((tag: string) => ( 
                              <motion.div 
                                key={`${category.id}-${tag}`} 
                                className={`${styles.tagItem} ${isTagSelected(category.id, tag) ? styles.selected : ''}`}
                                onClick={() => handleTagClick(category.id, tag)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <span className={styles.tagText}>{tag.replace(/_/g, ' ')}</span>
                              </motion.div>
                            ))}
                            
                            {/* Add indicator for scrolling if needed */}
                            {hasOverflow && (
                              <div className={styles.scrollMoreIndicator}>
                                <FaChevronDown />
                                <span>Scroll for more</span>
                              </div>
                            )}
                          </div>
                        ) : (
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
          
          {/* Scroll to top button - only visible when scrolled down */}
          {showScrollTopButton && (
            <button 
              className={styles.scrollTopButton}
              onClick={scrollToTop}
              title="Scroll to top"
            >
              <FaChevronUp />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MetadataFilterBar;
