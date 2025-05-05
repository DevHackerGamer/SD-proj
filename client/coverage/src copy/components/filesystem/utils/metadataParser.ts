import type { FileMetadata } from '../types';

/**
 * Parses raw Azure Blob metadata into the FileMetadata structure.
 * Handles converting comma-separated strings back into arrays for specific fields.
 */
export const parseBlobMetadataToFileMetadata = (blobMetadata: Record<string, string>): FileMetadata => {
    const parseStringToArray = (value?: string): string[] => {
        return value ? value.split(',').map(s => s.trim()).filter(s => s !== '') : [];
    };

    return {
        documentType: blobMetadata.documenttype || '',
        level: blobMetadata.level || '',
        language: blobMetadata.language || '',
        tags: parseStringToArray(blobMetadata.tags),
        topics: parseStringToArray(blobMetadata.topics),
        accessLevel: blobMetadata.accesslevel || '',
        fileType: blobMetadata.filetype || '',
        country: blobMetadata.country || '',
        jurisdiction: blobMetadata.jurisdiction || '',
        license: blobMetadata.license || '',
        entitiesMentioned: parseStringToArray(blobMetadata.entitiesmentioned),
        collection: blobMetadata.collection || '',
        // Map other fields if necessary
    };
};
