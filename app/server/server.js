import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  extractTextFromPDF,
  cleanPDFText,
  splitTextIntoChunks,
  storeChunksInChroma,
  queryChroma,
} from "./serverRAG.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use("/uploads", express.static(uploadDir));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// 🔁 This holds the latest collection (from uploaded OR preloaded PDF)
let collection = null;

// 🧠 Upload endpoint
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  try {
    console.log(`Uploaded: ${req.file.originalname}`);
    const pdfPath = path.join(uploadDir, req.file.filename);
    const rawText = await extractTextFromPDF(pdfPath);
    const cleanedText = cleanPDFText(rawText);
    const chunks = splitTextIntoChunks(cleanedText);
    collection = await storeChunksInChroma(chunks);
    res.status(200).json({
      message: "File uploaded and processed into ChromaDB.",
      fileName: req.file.filename,
      filePath: `/uploads/${req.file.filename}`,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to process the file." });
  }
});

// 💬 Query endpoint
app.post("/api/query", async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Query is required." });

  try {
    const answer = await queryChroma(query, collection);
    res.status(200).json({ answer: answer.answer });
  } catch (err) {
    console.error("Query error:", err);
    res.status(500).json({ error: "Failed to process query." });
  }
});

// 📄 Preload optional PDF at server start
// async function initializeChromaCollection() {
//   try {
//     const preloadPath = path.resolve(__dirname, "uploads", "South_Africa_2012-en.pdf");
//     if (!fs.existsSync(preloadPath)) return;

//     const rawText = await extractTextFromPDF(preloadPath);
//     const cleanedText = cleanPDFText(rawText);
//     const chunks = splitTextIntoChunks(cleanedText);
//     collection = await storeChunksInChroma(chunks);
//     console.log("Preloaded ChromaDB with default PDF.");
//   } catch (error) {
//     console.error("Error initializing Chroma collection:", error);
//   }
// }

// ✅ Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
//   initializeChromaCollection(); // Optionally preload PDF
});
