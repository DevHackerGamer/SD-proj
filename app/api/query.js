import cors from "cors";
import express from "express";
import { queryChroma, extractTextFromPDF, cleanPDFText, splitTextIntoChunks, storeChunksInChroma } from "../server/serverRAG.js";
import path from "path";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let collection = null;

// Load and prepare the collection once on server startup
async function initializeChromaCollection() {
    try {
        const pdfPath = path.resolve('/home/lawrence140/SD/cc/SD-proj/South_Africa_2012-en.pdf');
        const rawText = await extractTextFromPDF(pdfPath);
        if (!rawText) {
            throw new Error("Failed to extract text from PDF.");
        }
        const cleanedText = cleanPDFText(rawText);
        const chunks = splitTextIntoChunks(cleanedText);
        collection = await storeChunksInChroma(chunks);
        console.log("Chroma collection is ready.");
    } catch (error) {
        console.error("Error initializing Chroma collection:", error);
    }
}

// Initialize collection when server starts
initializeChromaCollection();

// Query endpoint
app.post("/api/query", async (req, res) => {
    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: "Query is required." });
    }

    try {
        console.log(`Query:(${query})`);
        const answer = await queryChroma(query, collection);
        res.status(200).json({ answer: answer.answer }); // Ensure consistent response
    } catch (error) {
        console.error("Error querying Chroma:", error);
        res.status(500).json({ error: "Failed to process query." });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});