import express from 'express';
import { queryPinecone } from '../pineconeStuff/pineconeServe.js';

const router = express.Router();

router.post('/query', async (req, res) => {
  try {
    const { queryText } = req.body;
    if (!queryText) {
      return res.status(400).json({ error: 'Query text is required.' });
    }
    const response = await queryPinecone(queryText);
    res.json(response);
  } catch (error) {
    console.error('[Server] Error querying Pinecone:', error);
    res.status(500).json({ error: 'Failed to query Pinecone.' });
  }
});

export { router};