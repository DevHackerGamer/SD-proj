import express from "express";
import multer from "multer";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
// Create uploads directory if it doesn't exist

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir,{recursive:true});
}

console.log(uploadDir);
// Multer setup: store files in 'uploads/'(new dir) and keep original name
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use("/uploads", express.static(uploadDir)); // serve uploaded files

// Upload endpoint
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }
  console.log("Uploaded file info: ",req.file);  
  res.status(200).json({
    message: "File uploaded successfully!",
    fileName: req.file.filename,
    filePath: `/uploads/${req.file.filename}`,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});