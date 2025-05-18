import {
  BlobServiceClient,
  StorageSharedKeyCredential
} from '@azure/storage-blob';
import dotenv from 'dotenv';
import path from 'path';

// --- Configuration ---
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;

console.log("[BlobHelpers] Loading configuration...");
console.log("[BlobHelpers] AZURE_STORAGE_CONNECTION_STRING provided:", !!connectionString);
console.log("[BlobHelpers] AZURE_STORAGE_CONTAINER_NAME:", containerName);

if (!connectionString || !containerName || !connectionString.includes('AccountName=') || !connectionString.includes('AccountKey=')) {
  const errorMsg = !connectionString ? "AZURE_STORAGE_CONNECTION_STRING is not defined."
                 : !containerName ? "AZURE_STORAGE_CONTAINER_NAME is not defined."
                 : "AZURE_STORAGE_CONNECTION_STRING format appears invalid.";
  console.error(`❌ FATAL: ${errorMsg}`);
  throw new Error(`Azure Storage configuration error: ${errorMsg}`);
}

// --- Get Azure account info ---
export const getAccountInfo = () => {
  if (accountName && accountKey) {
    return { accountName, accountKey };
  }
  
  try {
    const parts = connectionString.split(';');
    const accountNamePart = parts.find(p => p.startsWith('AccountName='));
    const accountKeyPart = parts.find(p => p.startsWith('AccountKey='));
    if (accountNamePart && accountKeyPart) {
      return {
        accountName: accountNamePart.split('=')[1],
        accountKey: accountKeyPart.split('=')[1]
      };
    }
  } catch (e) { /* ignore parsing errors */ }
  
  throw new Error("Azure Storage Account Name and Key are required for SAS generation and not found/parsable.");
};

// --- Azure Client Initialization ---
let containerClient;
let sharedKeyCredential;

try {
  console.log("[BlobHelpers] Initializing Azure BlobServiceClient...");
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  containerClient = blobServiceClient.getContainerClient(containerName);
  console.log(`✅ Azure BlobServiceClient initialized for container "${containerName}".`);
  
  const { accountName: name, accountKey: key } = getAccountInfo();
  sharedKeyCredential = new StorageSharedKeyCredential(name, key);
  console.log(`✅ SharedKeyCredential created for SAS generation.`);
} catch (error) {
  console.error("❌ FATAL: Failed to initialize Azure BlobServiceClient:", error);
  containerClient = null;
  console.error("❌ Azure client is NOT initialized. Endpoints will fail.");
  sharedKeyCredential = null;
  console.error("❌ SharedKeyCredential NOT created. SAS URL generation will fail.");
}

// --- Common helper functions ---
export const ensureClient = () => {
  if (!containerClient) {
    console.error("❌ Azure client not initialized.");
    throw new Error("Azure Blob Storage client is not available. Check server startup logs.");
  }
  return containerClient;
};

export const ensureClientAndCredentials = () => {
  ensureClient();
  if (!sharedKeyCredential) {
    console.error("❌ SharedKeyCredential not initialized.");
    throw new Error("Azure credential for SAS generation is not available.");
  }
  return { client: containerClient, credential: sharedKeyCredential };
};

export const streamToBuffer = async (readableStream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
};

export const safeJsonParse = (str) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};
