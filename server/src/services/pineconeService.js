import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

dotenv.config();
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
});

console.log('Initializing Pinecone client...');
if (!process.env.PINECONE_API_KEY) {
    console.error('PINECONE_API_KEY is not set in the environment variables.');
} else {
    console.log('PINECONE_API_KEY is set.');
}

export const upsertToPinecone = async (vectorId, text, fileName) => {
    try {
        console.log('Connecting to Pinecone index...');
        const index = pc.index('llama-text-embed-v2-index');
        console.log('Successfully connected to Pinecone index.');

        console.log('Upserting data to Pinecone...');
        const upsertResponse = await index.upsert([
                    {
                        id: vectorId,
                        text: text,
                        metadata: fileName,
                    },
        ]);
        console.log('Upsert response:', upsertResponse);
        return upsertResponse;
    } catch (error) {
        console.error('Error upserting to Pinecone:', error);
        throw error;
    }
};