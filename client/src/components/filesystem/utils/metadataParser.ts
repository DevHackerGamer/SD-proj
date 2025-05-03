import type { FileMetadata, StructuredPath } from '../types';

/**
 * Parses the flat Record<string, string> metadata from Azure Blob Storage
 * back into the structured FileMetadata object used by the client.
 * Handles potential missing fields and reconstructs the nested structure.
 *
 * @param {Record<string, string>} rawMetadata - The metadata object from Azure Blob properties.
 * @returns {FileMetadata} The structured metadata object.
 */
export const parseBlobMetadataToFileMetadata = (rawMetadata: Record<string, string>): FileMetadata => {
    console.log('[Parser] Raw metadata received:', rawMetadata);

    const metadata: FileMetadata = {};
    const structuredPath: StructuredPath = {}; // Initialize structuredPath

    // Helper to safely get value or return undefined
    const getValue = (key: string): string | undefined => rawMetadata[key] || undefined;

    // Helper to get value and split into array, handling undefined/empty
    const getArrayValue = (key: string): string[] => {
        const value = getValue(key);
        return value ? value.split(',').map(t => t.trim()).filter(t => t) : [];
    };

    // --- Parse Top-Level Fields ---
    metadata.documentId = getValue('documentid'); // Ensure lowercase key matching Azure format
    metadata.language = getValue('language');
    metadata.accessLevel = getValue('accesslevel');
    metadata.license = getValue('license');
    metadata.description = getValue('description');
    metadata.contentSummary = getValue('contentsummary'); // Or use description as fallback
    metadata.tags = getArrayValue('tags');
    // Note: fileType might be ambiguous (metadata vs. item.fileType), prioritize item.fileType if available
    metadata.fileType = getValue('filetype'); // Top-level fileType if stored

    // --- Reconstruct StructuredPath ---
    structuredPath.collection = getValue('collection');

    // Jurisdiction
    const jurisdictionType = getValue('jurisdiction_type');
    const jurisdictionName = getValue('jurisdiction_name');
    if (jurisdictionType || jurisdictionName) {
        structuredPath.jurisdiction = {
            type: jurisdictionType,
            name: jurisdictionName,
        };
    }

    // Thematic Focus
    const thematicFocusPrimary = getValue('thematicfocus_primary');
    const thematicFocusSubthemes = getArrayValue('thematicfocus_subthemes');
    if (thematicFocusPrimary || thematicFocusSubthemes.length > 0) {
        structuredPath.thematicFocus = {
            primary: thematicFocusPrimary,
            subthemes: thematicFocusSubthemes,
        };
    }

    // Issuing Authority
    const issuingAuthorityType = getValue('issuingauthority_type');
    const issuingAuthorityName = getValue('issuingauthority_name');
    if (issuingAuthorityType || issuingAuthorityName) {
        structuredPath.issuingAuthority = {
            type: issuingAuthorityType,
            name: issuingAuthorityName, // Server saves it as a single string now
        };
    }

    // Document Function, Version
    structuredPath.documentFunction = getValue('documentfunction');
    structuredPath.version = getValue('version');

    // Workflow Stage
    const workflowStagePrimary = getValue('workflowstage_primary');
    const workflowStageSub = getValue('workflowstage_sub');
    if (workflowStagePrimary || workflowStageSub) {
        structuredPath.workflowStage = {
            primary: workflowStagePrimary,
            sub: workflowStageSub,
        };
    }

    // Item Details
    const itemFileName = getValue('item_filename');
    const itemCleanedFileName = getValue('item_cleanedfilename');
    const itemFinalItemName = getValue('item_finalitemname');
    const itemFileType = getValue('item_filetype');
    const itemPublicationDate = getValue('item_publicationdate');

    if (itemFileName || itemCleanedFileName || itemFinalItemName || itemFileType || itemPublicationDate) {
        structuredPath.item = {
            fileName: itemFileName,
            cleanedFileName: itemCleanedFileName,
            finalItemName: itemFinalItemName,
            fileType: itemFileType,
            publicationDate: itemPublicationDate,
        };
        // If item_filetype exists, it's likely more specific than the top-level filetype
        if (itemFileType) {
            metadata.fileType = itemFileType;
        }
    }

    // Assign the reconstructed structuredPath if it has any keys
    if (Object.keys(structuredPath).length > 0) {
        metadata.structuredPath = structuredPath;
    }

    console.log('[Parser] Parsed FileMetadata:', metadata);
    return metadata;
};


// --- Keep formatMetadataForAzure if it's still used on the client for some reason ---
// --- Otherwise, it can be removed from the client-side parser ---

/**
 * Converts structured FileMetadata (likely for display or initial state)
 * into the Record<string, string> format suitable for Azure Blob Storage metadata.
 * Skips undefined/null/empty values.
 * Ensures keys are suitable for Azure (e.g., lowercase, no invalid chars - handled by Azure SDK).
 * NOTE: This function might be redundant if formatting only happens server-side.
 *
 * @param {FileMetadata} metadata - The structured metadata object.
 * @returns {Record<string, string>} A Record<string, string> for Azure Blob metadata.
 */
export const formatMetadataForAzure = (metadata: FileMetadata): Record<string, string> => {
    const azureMetadata: Record<string, string> = {};

    // Helper function to add if value exists and is not empty
    const addIfPresent = (key: string, value: string | string[] | undefined | null) => {
        // Ensure key is lowercase for consistency with Azure recommendations/server-side
        const lowerKey = key.toLowerCase();
        if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
                if (value.length > 0) {
                    // Join array elements with a comma
                    azureMetadata[lowerKey] = value.join(',');
                }
            } else if (typeof value === 'string' && value.trim() !== '') {
                azureMetadata[lowerKey] = value.trim();
            }
            // Add other type checks if necessary (e.g., numbers, booleans converted to string)
        }
    };

    // --- Map Top-Level Fields ---
    addIfPresent('documentId', metadata.documentId);
    addIfPresent('language', metadata.language);
    addIfPresent('tags', metadata.tags);
    addIfPresent('accessLevel', metadata.accessLevel);
    addIfPresent('fileType', metadata.fileType); // Top-level fileType
    addIfPresent('license', metadata.license);
    addIfPresent('description', metadata.description);
    addIfPresent('contentSummary', metadata.contentSummary);

    // --- Flatten StructuredPath ---
    if (metadata.structuredPath) {
        const sp = metadata.structuredPath;
        addIfPresent('collection', sp.collection);

        if (sp.jurisdiction) {
            addIfPresent('jurisdiction_type', sp.jurisdiction.type);
            addIfPresent('jurisdiction_name', sp.jurisdiction.name);
        }
        if (sp.thematicFocus) {
            addIfPresent('thematicfocus_primary', sp.thematicFocus.primary);
            addIfPresent('thematicfocus_subthemes', sp.thematicFocus.subthemes); // Will be comma-separated
        }
        if (sp.issuingAuthority) {
            addIfPresent('issuingauthority_type', sp.issuingAuthority.type);
            addIfPresent('issuingauthority_name', sp.issuingAuthority.name); // Assumes name is string
        }
        addIfPresent('documentfunction', sp.documentFunction);
        addIfPresent('version', sp.version);
        if (sp.workflowStage) {
            addIfPresent('workflowstage_primary', sp.workflowStage.primary);
            addIfPresent('workflowstage_sub', sp.workflowStage.sub);
        }
        if (sp.item) {
            addIfPresent('item_filename', sp.item.fileName);
            addIfPresent('item_cleanedfilename', sp.item.cleanedFileName);
            addIfPresent('item_finalitemname', sp.item.finalItemName);
            addIfPresent('item_filetype', sp.item.fileType); // Item-specific fileType
            addIfPresent('item_publicationdate', sp.item.publicationDate);
        }
    }

    console.log('[Parser] Formatted Metadata for Azure (Client-side):', azureMetadata);
    return azureMetadata;
};
