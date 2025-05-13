import { pipeline } from "@xenova/transformers";
import { normalize } from "path";
import fs from 'fs/promises';
import path from 'path';
import { PDFExtract } from 'pdf.js-extract';

const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

// ---------- TEXT CLEANING ----------
function cleanExtractedText(text) {
    return text
        .replace(/(\r?\n){2,}/g, '\n\n')           // Keep paragraph breaks
        .replace(/([^\n])\n([^\n])/g, '$1 $2')     // Join broken lines
        .replace(/[ \t]+/g, ' ')                   // Collapse whitespace
        .replace(/\s+([.,;:!?])/g, '$1')           // Remove space before punctuation
        .trim();
}

// ---------- OPTIONAL SECTION CHUNKING ----------
function splitIntoSections(text) {
    return text.split(/\n(?=\d+\.\s)/); // Split on newlines before numbered sections like "10. "
}


//function to extract features from text

export async function extractFeatures(textVector) {
    const features = await extractor(
        textVector, // assumes there may be multiple texts
        {pooling: 'mean', normalize: 'true'});

    return Array.from(features.data);    

}

// ---------- PDF TEXT EXTRACTION ----------
export async function extractTextFromPDF(pdfBuffer) {
    const pdfExtract = new PDFExtract();
    const options = {
        // Custom PDF extract options if needed
    };

    const tempFilePath = path.join('/tmp', `temp-${Date.now()}.pdf`);

    try {
        await fs.writeFile(tempFilePath, pdfBuffer);
        const data = await pdfExtract.extract(tempFilePath, options);

        let text = '';
        data.pages.forEach((page) => {
            text += page.content.map((item) => item.str).join(' ') + '\n';
        });

        console.log(`[PDFExtract] Raw text length: ${text.length}`);
        const cleanedText = cleanExtractedText(text);
        console.log(`[PDFExtract] Cleaned text length: ${cleanedText.length}`);
        return cleanedText;

    } catch (error) {
        console.error("[PDFExtract] Error extracting text from PDF:", error);
        throw error;
    } finally {
        await fs.unlink(tempFilePath).catch((err) => {
            console.warn(`[PDFExtract] Failed to delete temp file: ${tempFilePath}`, err);
        });
    }
}

