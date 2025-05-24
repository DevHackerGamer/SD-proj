import {
  BlobServiceClient,
  StorageSharedKeyCredential
} from '@azure/storage-blob';
import { getAccountInfo, containerName, connectionString } from './generateDocumentSas.js'; 
import { findDocumentBlob } from './generateDocumentSas.js';
import { searchByMetadata } from './generateDocumentSas.js';

/**
 * Given a documentId, find its blob and return the `title` metadata.
 */
  export async function returnTitle(containerClient, documentId) {
    
    let foundBlob = null;
    let continuationToken = null;
    
    try {
      do {
        const response = await containerClient.listBlobsFlat({
          maxPageSize: 50,
          continuationToken: continuationToken,
          includeMetadata: true // Important: request metadata
        }).byPage().next();
        
        const segment = response.value;
        continuationToken = segment.continuationToken;
        
        // console.log(`Checking batch of ${segment.segment.blobItems.length} blobs...`);
        
        for (const blob of segment.segment.blobItems) {
          if (blob.metadata) {
            // Check all possible metadata keys (case-insensitive)
            const metadataKeys = Object.keys(blob.metadata).map(k => k.toLowerCase());
            const metadataValues = Object.values(blob.metadata);
            
            const hasDocIdInMetadata = metadataKeys.includes('documentid') || 
                                       metadataKeys.includes('docid') || 
                                       metadataKeys.includes('id');
            
            const hasDocIdInValues = metadataValues.some(v => 
              v.toString().toLowerCase() === documentId.toLowerCase()
            );
            
            if (hasDocIdInMetadata || hasDocIdInValues) {
            //   console.log(`✓ Found blob with matching metadata: ${blob.name}`);
            //   console.log(`Metadata: ${JSON.stringify(blob.metadata)}`);
              foundBlob = blob.metadata.originalfilename;
              break;
            }
          }
        }
        
        if (foundBlob) break;
        
      } while (continuationToken);
      
      return foundBlob;
    } catch (error) {
    //   console.error(`Error during metadata search: ${error.message}`);
      return null;
    }
  }