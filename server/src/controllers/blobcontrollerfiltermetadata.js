import path from 'path';
import { ensureClient, streamToBuffer, safeJsonParse } from './blobHelpers.js';

// Helper function to normalize strings for comparison
const normalizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase()
    .replace(/_/g, ' ')  // Replace underscores with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim();
};

// Enhanced matching function for flexible comparison
const doesValueMatch = (value, searchTag) => {
  if (!value || typeof value !== 'string') return false;
  
  const normalizedValue = normalizeString(value);
  const normalizedSearchTag = normalizeString(searchTag);
  
  return normalizedValue.includes(normalizedSearchTag);
};

export const searchByMetadata = async (req, res) => {
  console.log('[Server] Request: /search - Searching by metadata');
  
  const { 
    tags, 
    currentPath, 
    deepSearch = false, 
    filterLogic = 'AND'
  } = req.body;
  
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ message: 'At least one tag is required for searching' });
  }
  
  console.log(`[Server] /search - Using ${filterLogic} logic`);
  console.log(`[Server] /search - Searching for tags: ${JSON.stringify(tags.map(t => `${t.category}:${t.tag}`))}`);
  
  try {
    const client = ensureClient();
    const matchingFiles = [];
    
    // Set search prefix based on search mode
    const searchPrefix = deepSearch ? '' : currentPath ? `${currentPath}/` : '';
    console.log(`[Server] /search - Using prefix: "${searchPrefix}", Deep search: ${deepSearch}`);
    
    let continuationToken = null;
    const PAGE_SIZE = 100; // Azure recommended batch size
    let processedFiles = 0;
    
    do {
      // Get a batch of blobs (flat list for deep search, or limited to current directory)
      const response = await client.listBlobsFlat({
        prefix: searchPrefix,
        includeMetadata: true, // Critical: include metadata for filtering
        maxPageSize: PAGE_SIZE,
        continuationToken: continuationToken
      }).byPage().next();
      
      const segment = response.value;
      continuationToken = segment.continuationToken;
      
      console.log(`[Server] /search - Processing batch of ${segment.segment.blobItems.length} blobs...`);
      
      // Process each blob
      for (const blob of segment.segment.blobItems) {
        processedFiles++;
        
        // Skip directory placeholders and metadata.json files
        if (blob.name.endsWith('/') || blob.name.endsWith('/metadata.json')) {
          continue;
        }
        
        // Get file metadata from blob metadata and/or from metadata.json
        const blobMetadata = blob.metadata || {};
        const fileName = path.basename(blob.name);
        const directoryPath = path.dirname(blob.name);
        
        let metadataJsonEntry = null;
        
        // First check if we can find this file in a metadata.json file
        try {
          // Try to find associated metadata.json entry
          const dirForMeta = directoryPath === '.' ? '' : directoryPath;
          const metadataJsonPath = path.posix.join(dirForMeta, 'metadata.json');
          const metadataBlobClient = client.getBlockBlobClient(metadataJsonPath);
          
          if (await metadataBlobClient.exists()) {
            const downloadResponse = await metadataBlobClient.download(0);
            const contentBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
            const metadataJson = safeJsonParse(contentBuffer.toString());
            
            if (metadataJson && metadataJson.files && metadataJson.files[fileName]) {
              metadataJsonEntry = metadataJson.files[fileName];
              console.log(`[Server] /search - Found metadata.json entry for ${fileName}`);
            }
          }
        } catch (metadataError) {
          console.warn(`[Server] /search - Error fetching metadata.json for ${blob.name}:`, metadataError.message);
          // Continue with blob metadata only
        }
        
        // Combine metadata sources, with metadata.json taking precedence
        const combinedMetadata = { ...blobMetadata };
        if (metadataJsonEntry) {
          // Extract nested fields from the structured metadata
          if (metadataJsonEntry.structuredPath) {
            const structuredPath = metadataJsonEntry.structuredPath;
            
            // Map nested fields to flat structure for easier searching
            if (structuredPath.collection) {
              combinedMetadata.collection = structuredPath.collection;
            }
            
            if (structuredPath.jurisdiction) {
              if (structuredPath.jurisdiction.type) {
                combinedMetadata.jurisdiction_type = structuredPath.jurisdiction.type;
              }
              if (structuredPath.jurisdiction.name) {
                combinedMetadata.jurisdiction_name = structuredPath.jurisdiction.name;
              }
            }
            
            if (structuredPath.thematicFocus) {
              if (structuredPath.thematicFocus.primary) {
                combinedMetadata.thematicfocus_primary = structuredPath.thematicFocus.primary;
              }
              if (structuredPath.thematicFocus.subthemes && Array.isArray(structuredPath.thematicFocus.subthemes)) {
                combinedMetadata.thematicfocus_subthemes = structuredPath.thematicFocus.subthemes.join(',');
              }
            }
            
            if (structuredPath.issuingAuthority) {
              if (structuredPath.issuingAuthority.type) {
                combinedMetadata.issuingauthority_type = structuredPath.issuingAuthority.type;
              }
              if (structuredPath.issuingAuthority.name) {
                combinedMetadata.issuingauthority_name = structuredPath.issuingAuthority.name;
              }
            }
            
            if (structuredPath.documentFunction) {
              combinedMetadata.documentfunction = structuredPath.documentFunction;
            }
            
            if (structuredPath.version) {
              combinedMetadata.version = structuredPath.version;
            }
            
            if (structuredPath.workflowStage) {
              if (structuredPath.workflowStage.primary) {
                combinedMetadata.workflowstage_primary = structuredPath.workflowStage.primary;
              }
              if (structuredPath.workflowStage.sub) {
                combinedMetadata.workflowstage_sub = structuredPath.workflowStage.sub;
              }
            }
            
            if (structuredPath.item) {
              if (structuredPath.item.fileType) {
                combinedMetadata.filetype = structuredPath.item.fileType;
              }
              if (structuredPath.item.publicationDate) {
                combinedMetadata.publicationdate = structuredPath.item.publicationDate;
              }
            }
          }
          
          // Add the direct properties as well
          Object.entries(metadataJsonEntry).forEach(([key, value]) => {
            if (key !== 'structuredPath') {
              combinedMetadata[key.toLowerCase()] = value;
            }
          });
        }
        
        // Check if the file matches all/any of the search tags
        if (filterLogic === 'AND') {
          // AND logic - all tags must match
          let matches = true;
          for (const { category, tag } of tags) {
            let categoryMatched = false;
            // Handle categories with special transformations
            const searchTag = tag.replace(/ /g, '_'); // Replace spaces with underscores for comparison
            
            // First, try direct match with specific known fields
            switch(category.toLowerCase()) {
              case 'collection':
                categoryMatched = combinedMetadata.collection && 
                  doesValueMatch(combinedMetadata.collection, searchTag);
                break;
                
              case 'jurisdictiontype':
                categoryMatched = combinedMetadata.jurisdiction_type && 
                  doesValueMatch(combinedMetadata.jurisdiction_type, searchTag);
                break;
                
              case 'jurisdictionname':
                categoryMatched = combinedMetadata.jurisdiction_name && 
                  doesValueMatch(combinedMetadata.jurisdiction_name, searchTag);
                break;
                
              case 'thematicfocusprimary':
                categoryMatched = combinedMetadata.thematicfocus_primary && 
                  doesValueMatch(combinedMetadata.thematicfocus_primary, searchTag);
                break;
                
              case 'thematicfocussubthemes':
                if (combinedMetadata.thematicfocus_subthemes) {
                  const subthemes = combinedMetadata.thematicfocus_subthemes.split(',')
                    .map(t => t.trim().replace(/ /g, '_'));
                  categoryMatched = subthemes.some(theme => doesValueMatch(theme, searchTag));
                }
                break;
                
              case 'documentfunction':
                categoryMatched = combinedMetadata.documentfunction && 
                  doesValueMatch(combinedMetadata.documentfunction, searchTag);
                break;
                
              case 'version':
                categoryMatched = combinedMetadata.version && 
                  doesValueMatch(combinedMetadata.version, searchTag);
                break;
                
              case 'language':
                categoryMatched = combinedMetadata.language && 
                  doesValueMatch(combinedMetadata.language, searchTag);
                break;
                
              case 'filetype':
                categoryMatched = combinedMetadata.filetype && 
                  doesValueMatch(combinedMetadata.filetype, searchTag);
                break;
                
              case 'tags':
                if (combinedMetadata.tags) {
                  const fileTags = combinedMetadata.tags.split(',')
                    .map(t => t.trim().replace(/ /g, '_'));
                  categoryMatched = fileTags.some(fileTag => doesValueMatch(fileTag, searchTag));
                }
                break;
                
              case 'accesslevel':
                categoryMatched = combinedMetadata.accesslevel && 
                  doesValueMatch(combinedMetadata.accesslevel, searchTag);
                break;
                
              case 'license':
                categoryMatched = combinedMetadata.license && 
                  doesValueMatch(combinedMetadata.license, searchTag);
                break;
                
              case 'issuingauthority_type':
                // Check both direct metadata and structured path
                categoryMatched = (combinedMetadata.issuingauthority_type && 
                  doesValueMatch(combinedMetadata.issuingauthority_type, searchTag)) ||
                  // Check root level metadata too
                  (combinedMetadata.issuing_authority_type && 
                  doesValueMatch(combinedMetadata.issuing_authority_type, searchTag));
                break;
                
              case 'workflowstage_primary':
                categoryMatched = (combinedMetadata.workflowstage_primary && 
                  doesValueMatch(combinedMetadata.workflowstage_primary, searchTag)) ||
                  // Additional check for non-normalized field
                  (combinedMetadata.workflow_stage_primary && 
                  doesValueMatch(combinedMetadata.workflow_stage_primary, searchTag));
                break;
                
              default:
                // For any other category, try to match against all metadata fields
                categoryMatched = Object.entries(combinedMetadata).some(([key, value]) => {
                  if (typeof value === 'string') {
                    // Check if key contains the category (case-insensitive)
                    if (key.toLowerCase().includes(category.toLowerCase())) {
                      return doesValueMatch(value, searchTag);
                    }
                  }
                  return false;
                });
            }
            
            if (!categoryMatched) {
              matches = false;
              break;
            }
          }
          
          if (matches) {
            matchingFiles.push({
              id: `blob:${blob.name}`,
              name: fileName,
              path: blob.name,
              isDirectory: false,
              size: blob.properties.contentLength,
              lastModified: blob.properties.lastModified,
              contentType: blob.properties.contentType,
              metadata: combinedMetadata
            });
          }
        } else {
          // OR logic - match any tag
          let anyMatched = false;
          
          for (const { category, tag } of tags) {
            let categoryMatched = false;
            // Handle categories with special transformations
            const searchTag = tag.replace(/ /g, '_'); // Replace spaces with underscores for comparison
            
            // First, try direct match with specific known fields
            switch(category.toLowerCase()) {
              case 'collection':
                categoryMatched = combinedMetadata.collection && 
                  doesValueMatch(combinedMetadata.collection, searchTag);
                break;
                
              case 'jurisdictiontype':
                categoryMatched = combinedMetadata.jurisdiction_type && 
                  doesValueMatch(combinedMetadata.jurisdiction_type, searchTag);
                break;
                
              case 'jurisdictionname':
                categoryMatched = combinedMetadata.jurisdiction_name && 
                  doesValueMatch(combinedMetadata.jurisdiction_name, searchTag);
                break;
                
              case 'thematicfocusprimary':
                categoryMatched = combinedMetadata.thematicfocus_primary && 
                  doesValueMatch(combinedMetadata.thematicfocus_primary, searchTag);
                break;
                
              case 'thematicfocussubthemes':
                if (combinedMetadata.thematicfocus_subthemes) {
                  const subthemes = combinedMetadata.thematicfocus_subthemes.split(',')
                    .map(t => t.trim().replace(/ /g, '_'));
                  categoryMatched = subthemes.some(theme => doesValueMatch(theme, searchTag));
                }
                break;
                
              case 'documentfunction':
                categoryMatched = combinedMetadata.documentfunction && 
                  doesValueMatch(combinedMetadata.documentfunction, searchTag);
                break;
                
              case 'version':
                categoryMatched = combinedMetadata.version && 
                  doesValueMatch(combinedMetadata.version, searchTag);
                break;
                
              case 'language':
                categoryMatched = combinedMetadata.language && 
                  doesValueMatch(combinedMetadata.language, searchTag);
                break;
                
              case 'filetype':
                categoryMatched = combinedMetadata.filetype && 
                  doesValueMatch(combinedMetadata.filetype, searchTag);
                break;
                
              case 'tags':
                if (combinedMetadata.tags) {
                  const fileTags = combinedMetadata.tags.split(',')
                    .map(t => t.trim().replace(/ /g, '_'));
                  categoryMatched = fileTags.some(fileTag => doesValueMatch(fileTag, searchTag));
                }
                break;
                
              case 'accesslevel':
                categoryMatched = combinedMetadata.accesslevel && 
                  doesValueMatch(combinedMetadata.accesslevel, searchTag);
                break;
                
              case 'license':
                categoryMatched = combinedMetadata.license && 
                  doesValueMatch(combinedMetadata.license, searchTag);
                break;
                
              case 'issuingauthority_type':
                // Check both direct metadata and structured path
                categoryMatched = (combinedMetadata.issuingauthority_type && 
                  doesValueMatch(combinedMetadata.issuingauthority_type, searchTag)) ||
                  // Check root level metadata too
                  (combinedMetadata.issuing_authority_type && 
                  doesValueMatch(combinedMetadata.issuing_authority_type, searchTag));
                break;
                
              case 'workflowstage_primary':
                categoryMatched = (combinedMetadata.workflowstage_primary && 
                  doesValueMatch(combinedMetadata.workflowstage_primary, searchTag)) ||
                  // Additional check for non-normalized field
                  (combinedMetadata.workflow_stage_primary && 
                  doesValueMatch(combinedMetadata.workflow_stage_primary, searchTag));
                break;
                
              default:
                // For any other category, try to match against all metadata fields
                categoryMatched = Object.entries(combinedMetadata).some(([key, value]) => {
                  if (typeof value === 'string') {
                    // Check if key contains the category (case-insensitive)
                    if (key.toLowerCase().includes(category.toLowerCase())) {
                      return doesValueMatch(value, searchTag);
                    }
                  }
                  return false;
                });
            }
            
            if (categoryMatched) {
              anyMatched = true;
              break; // Any match is sufficient
            }
          }
          
          if (anyMatched) {
            matchingFiles.push({
              id: `blob:${blob.name}`,
              name: fileName,
              path: blob.name,
              isDirectory: false,
              size: blob.properties.contentLength,
              lastModified: blob.properties.lastModified,
              contentType: blob.properties.contentType,
              metadata: combinedMetadata
            });
          }
        }
      }
      
      // Optional: limit total number of files to process to prevent excessive processing
      const MAX_FILES_TO_PROCESS = 10000;
      if (processedFiles >= MAX_FILES_TO_PROCESS) {
        console.log(`[Server] /search - Reached maximum file processing limit (${MAX_FILES_TO_PROCESS})`);
        break;
      }
      
    } while (continuationToken);
    
    console.log(`[Server] /search - Found ${matchingFiles.length} matching files using ${filterLogic} logic`);
    
    // Return search results
    res.status(200).json({
      items: matchingFiles,
      totalItems: matchingFiles.length,
      message: `Found ${matchingFiles.length} matching files (${filterLogic} logic)`
    });
    
  } catch (error) {
    console.error('[Server] Error during metadata search:', error);
    res.status(500).json({ 
      message: 'Error searching files by metadata',
      error: error.message,
      details: error.code
    });
  }
};
