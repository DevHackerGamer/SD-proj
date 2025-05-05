import { pipeline } from "@xenova/transformers";
import { normalize } from "path";
import fs from 'fs/promises';
import path from 'path';
import { PDFExtract } from 'pdf.js-extract';

const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");


//function to extract features from text

export async function extractFeatures(textVector) {
    const features = await extractor(
        textVector, // assumes there may be multiple texts
        {pooling: 'mean', normalize: 'true'});

    return Array.from(features.data);    

}

// function to extract text from pdf

export async function extractTextFromPDF(pdfBuffer) {
    const pdfExtract = new PDFExtract();
    const options = {
        // Add any options you need here, e.g., disableCombineTextItems: true
    };

    // Create a temporary file
    const tempFilePath = path.join('/tmp', `temp-${Date.now()}.pdf`);
    try {
        // Write the buffer to the temporary file
        await fs.writeFile(tempFilePath, pdfBuffer);

        // Extract text from the temporary file
        const data = await pdfExtract.extract(tempFilePath, options);

        // Extract text from all pages
        let text = '';
        data.pages.forEach((page) => {
            text += page.content.map((item) => item.str).join(' ') + '\n';
        });

        console.log(`[PDFExtract] Extracted text length: ${text.length}`);
        return text.trim(); // Return the extracted text
    } catch (error) {
        console.error("[PDFExtract] Error extracting text from PDF:", error);
        throw error;
    } finally {
        // Clean up the temporary file
        await fs.unlink(tempFilePath).catch((err) => {
            console.warn(`[PDFExtract] Failed to delete temporary file: ${tempFilePath}`, err);
        });
    }
}

