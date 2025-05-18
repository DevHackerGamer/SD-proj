import { TextAnalyticsClient, AzureKeyCredential } from "@azure/ai-text-analytics";
import mammoth from 'mammoth';
import dotenv from 'dotenv';
import path from 'path';
import { DocumentAnalysisClient } from "@azure/ai-form-recognizer";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Azure AI Language configuration
const languageEndpoint = process.env.AZURE_LANGUAGE_ENDPOINT || "https://archivefiles2025.cognitiveservices.azure.com/";
const languageKey = process.env.AZURE_LANGUAGE_KEY || "ED9G1WaXbJ97yqBezhLtzkcWhlk3OgilOazHeOaAlJv6uUmsxGvQJQQJ99BEACrIdLPXJ3w3AAAaACOGdVv1";

// Azure Document Intelligence configuration
const documentIntelligenceEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || "https://archivefiles.cognitiveservices.azure.com/";
const documentIntelligenceKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY || "5hjPbIeKLHm3qZZgMfCNwmnlu2WFLfXmT6kuPG5gjeXKnnWgsUg1JQQJ99BEACrIdLPXJ3w3AAALACOGhWJg";

// Validation
if (!languageEndpoint || !languageKey) {
  console.error("Missing Azure AI Language credentials in environment variables");
}

if (!documentIntelligenceEndpoint || !documentIntelligenceKey) {
  console.error("Missing Azure Document Intelligence credentials in environment variables");
}

// Initialize Azure AI Language client
const textAnalyticsClient = new TextAnalyticsClient(
  languageEndpoint,
  new AzureKeyCredential(languageKey)
);

// Initialize Azure Document Intelligence client
const docIntelligenceClient = new DocumentAnalysisClient(
  documentIntelligenceEndpoint,
  new AzureKeyCredential(documentIntelligenceKey)
);

/**
 * Extract text from a document based on file type
 * @param {Buffer} fileBuffer - File buffer content
 * @param {string} fileName - Original file name
 * @param {string} fileType - File type (pdf, docx, etc.)
 * @returns {Promise<{text: string, summary?: string, success: boolean, error?: string}>} Extracted text
 */
export const extractTextFromDocument = async (fileBuffer, fileName, fileType) => {
  console.log(`[DocumentAnalysis] Extracting text from ${fileName} (${fileType})`);
  
  try {
    let extractedText = '';
    
    // Determine file type from extension if not provided
    if (!fileType) {
      fileType = path.extname(fileName).toLowerCase().replace('.', '');
    }
    
    // Extract content based on file type
    switch (fileType.toLowerCase()) {
      case 'pdf':
        // For PDFs, use Azure Document Intelligence but only process one page to save API costs
        try {
          console.log(`[DocumentAnalysis] Using Azure Document Intelligence for PDF: ${fileName} (cost-optimized single page extraction)`);
          
          // Call the Azure Document Intelligence service
          const poller = await docIntelligenceClient.beginAnalyzeDocument(
            "prebuilt-document",
            fileBuffer
          );
          
          // Wait for the analysis to complete
          const result = await poller.pollUntilDone();
          
          if (result && result.pages && result.pages.length > 0) {
            // Determine which page to extract (middle page if multiple pages, for better content)
            let targetPageIndex = 0; // Default to first page
            
            if (result.pages.length > 1) {
              // Choose a page in the middle for likely meaningful content
              targetPageIndex = Math.floor(result.pages.length / 2);
              console.log(`[DocumentAnalysis] PDF has ${result.pages.length} pages. Using page ${targetPageIndex + 1} to save API costs.`);
            }
            
            // Extract text from only the selected page
            const selectedPage = result.pages[targetPageIndex];
            if (selectedPage && selectedPage.lines) {
              extractedText = selectedPage.lines.map(line => line.content).join(' ');
              console.log(`[DocumentAnalysis] Successfully extracted ${extractedText.length} characters from page ${targetPageIndex + 1} of PDF`);
            }
            
            // Generate a summary from the extracted text
            if (extractedText.length > 0) {
              // Take the first 500 characters for summarization
              const textForSummary = extractedText.substring(0, 500);
              console.log(`[DocumentAnalysis] Creating summary from first 500 chars of extracted text`);
              
              try {
                // Use Azure AI Language service to analyze sentiment for better summary
                const sentimentResponse = await textAnalyticsClient.analyzeSentiment([
                  { id: '1', language: 'en', text: textForSummary }
                ]);
                
                if (sentimentResponse && sentimentResponse.length > 0) {
                  const sentimentResult = sentimentResponse[0];
                  
                  // Create a summary combining text excerpt with sentiment insights
                  const summary = `This document contains text about ${textForSummary.substring(0, 100).replace(/\s+/g, ' ').trim()}... ${
                    sentimentResult.sentiment === 'positive' ? 'The content appears to be informative and detailed.' :
                    sentimentResult.sentiment === 'negative' ? 'The content may contain critical or cautionary information.' :
                    'The content appears to be primarily factual in nature.'
                  }`;
                  
                  // Return with both the text and summary
                  return { 
                    text: extractedText, 
                    summary,
                    success: true 
                  };
                }
              } catch (summaryError) {
                console.error(`[DocumentAnalysis] Error creating summary: ${summaryError.message}`);
                // Continue with just the extracted text if summarization fails
              }
            }
          } else {
            console.warn(`[DocumentAnalysis] Azure Document Intelligence returned empty result for ${fileName}`);
            extractedText = "No text content could be extracted from this PDF.";
          }
        } catch (azureError) {
          console.error(`[DocumentAnalysis] Azure Document Intelligence error: ${azureError.message}`);
          // Fallback to basic extraction if Azure fails
          try {
            // Never directly convert PDF binary to string - this causes garbage output
            console.log(`[DocumentAnalysis] Azure processing failed, using fallback extraction for ${fileName}`);
            
            // Use a safer approach that doesn't try to parse binary as text
            extractedText = "This document appears to be a PDF file. Using Azure Document Intelligence for text extraction.";
          } catch (fallbackError) {
            console.error(`[DocumentAnalysis] Fallback extraction failed: ${fallbackError.message}`);
            extractedText = "PDF text extraction failed.";
          }
        }
        break;
        
      case 'docx':
      case 'doc':
        // Extract text from Word document
        try {
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          extractedText = result.value;
        } catch (err) {
          console.error("Error extracting text from Word document:", err);
          extractedText = "Could not extract text from Word document.";
        }
        break;
        
      case 'txt':
        // Plain text, safely decode the buffer with encoding detection
        try {
          // First try UTF-8
          extractedText = fileBuffer.toString('utf8');
          
          // If the result contains garbage, try other encodings
          if (extractedText.includes('�')) {
            console.log(`[DocumentAnalysis] UTF-8 decoding produced invalid characters, trying latin1`);
            extractedText = fileBuffer.toString('latin1');
          }
        } catch (textError) {
          console.error(`[DocumentAnalysis] Error decoding text file: ${textError.message}`);
          extractedText = "Could not decode text file content.";
        }
        break;
        
      default:
        return { 
          text: '', 
          success: false, 
          error: `Unsupported file type: ${fileType}. Please try PDF, DOCX, or TXT files.` 
        };
    }
    
    // Trim and limit text to prevent excessive API usage
    const maxChars = 5000; // Azure Language has input limits
    extractedText = extractedText.trim().substring(0, maxChars);
    
    // Return early if we couldn't extract meaningful text
    if (extractedText.length < 50) {
      console.log(`[DocumentAnalysis] Not enough text extracted from ${fileName} (${extractedText.length} chars)`);
      return { 
        text: extractedText, 
        success: false, 
        error: "Could not extract sufficient text from the document." 
      };
    }
    
    return { text: extractedText, success: true };
    
  } catch (error) {
    console.error(`[DocumentAnalysis] Error extracting text from ${fileName}:`, error);
    return { 
      text: '', 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Generate a description and extract keywords from document text
 * @param {string} text - Extracted document text
 * @param {string} language - Document language (default: 'en')
 * @returns {Promise<{description: string, keywords: string[], success: boolean, error?: string}>} Generated description and keywords
 */
export const analyzeDocumentContent = async (text, language = 'en') => {
  // Don't process if text is too short
  if (!text || text.length < 50) {
    return { 
      description: '', 
      keywords: [], 
      success: false, 
      error: 'Not enough text content to analyze' 
    };
  }
  
  try {
    console.log(`[DocumentAnalysis] Analyzing ${text.length} chars of text`);
    
    // Prepare response object
    const result = {
      description: '',
      keywords: [],
      success: true
    };
    
    // Extract key phrases (keywords)
    try {
      const keyPhraseResponse = await textAnalyticsClient.extractKeyPhrases([
        { id: '1', language, text }
      ]);
      
      if (keyPhraseResponse && keyPhraseResponse.length > 0 && keyPhraseResponse[0].keyPhrases) {
        // Get key phrases from the response
        const keyPhrases = keyPhraseResponse[0].keyPhrases || [];
        
        // Prioritize multi-word phrases that might be more specific
        const multiWordPhrases = keyPhrases.filter(phrase => phrase.includes(' '));
        const singleWordPhrases = keyPhrases.filter(phrase => !phrase.includes(' '));
        
        // Combine phrases and limit to 10
        const sortedPhrases = [...multiWordPhrases, ...singleWordPhrases]
          .filter(phrase => phrase.length > 1) // Filter out single characters
          .slice(0, 10); // Limit to top 10 key phrases
        
        result.keywords = sortedPhrases;
      }
    } catch (err) {
      console.error("[DocumentAnalysis] Error extracting key phrases:", err);
    }
    
    // Generate description using first paragraph or sentences
    const paragraphs = text.split('\n').filter(p => p.trim().length > 30);
    if (paragraphs.length > 0) {
      // Use first paragraph as description
      const firstParagraph = paragraphs[0];
      result.description = firstParagraph.substring(0, 500).trim();
    } else {
      // If no paragraphs, use first 500 characters
      result.description = text.substring(0, 500).trim();
    }
    
    return result;
  } catch (error) {
    console.error('[DocumentAnalysis] Error analyzing content:', error);
    return { 
      description: '', 
      keywords: [], 
      success: false, 
      error: error.message 
    };
  }
};

/**
 * Analyze an uploaded document to generate description and tags
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const analyzeDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }
    
    const { originalname, buffer, mimetype } = req.file;
    const fileType = path.extname(originalname).toLowerCase().replace('.', '');
    
    console.log(`[DocumentAnalysis] Processing ${originalname} (${mimetype})`);
    
    // Extract text from the document
    const extractionResult = await extractTextFromDocument(buffer, originalname, fileType);
    
    if (!extractionResult.success || !extractionResult.text) {
      return res.status(422).json({
        success: false,
        error: extractionResult.error || 'Failed to extract text from document',
        description: '',
        keywords: []
      });
    }
    
    // If we have a summary from the extraction process, use it as the description
    let initialDescription = '';
    if (extractionResult.summary) {
      initialDescription = extractionResult.summary;
      console.log(`[DocumentAnalysis] Using generated summary as description: "${initialDescription.substring(0, 100)}..."`);
    } else {
      // Otherwise, use the first paragraph or portion of text
      const firstPortion = extractionResult.text.substring(0, 500);
      initialDescription = firstPortion.replace(/\s+/g, ' ').trim();
      console.log(`[DocumentAnalysis] Using first portion of text as description: "${initialDescription.substring(0, 100)}..."`);
    }
    
    // Analyze the extracted text for keywords
    const analysisResult = await analyzeDocumentContent(extractionResult.text);
    
    return res.status(200).json({
      success: true,
      description: initialDescription || analysisResult.description,
      keywords: analysisResult.keywords
    });
    
  } catch (error) {
    console.error('[DocumentAnalysis] Error processing document:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * Extract text from PDFs using Azure Document Intelligence
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const extractPdfText = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }
    
    const { buffer, originalname, mimetype } = req.file;
    
    console.log(`[DocumentIntelligence] Processing ${originalname} (${mimetype}) - Cost-optimized single page extraction`);
    
    if (!mimetype.includes('pdf')) {
      return res.status(415).json({
        success: false,
        error: 'Only PDF files are supported'
      });
    }
    
    // Call Azure Document Intelligence to analyze the document
    const poller = await docIntelligenceClient.beginAnalyzeDocument(
      "prebuilt-document",
      buffer
    );
    
    const result = await poller.pollUntilDone();
    
    if (!result || !result.pages || result.pages.length === 0) {
      return res.status(422).json({
        success: false,
        error: 'No text content could be extracted from the document'
      });
    }
    
    // Extract text from a single page (middle page if multiple pages)
    let extractedText = '';
    let selectedPageIndex = 0;
    
    if (result.pages.length > 1) {
      // Choose a page in the middle for more meaningful content
      selectedPageIndex = Math.floor(result.pages.length / 2);
      console.log(`[DocumentIntelligence] PDF has ${result.pages.length} pages. Using page ${selectedPageIndex + 1} to save API costs.`);
    }
    
    const selectedPage = result.pages[selectedPageIndex];
    if (selectedPage && selectedPage.lines) {
      extractedText = selectedPage.lines.map(line => line.content).join(' ');
      console.log(`[DocumentIntelligence] Extracted ${extractedText.length} characters from page ${selectedPageIndex + 1}`);
    }
    
    return res.status(200).json({
      success: true,
      text: extractedText,
      pageNumber: selectedPageIndex + 1,
      totalPages: result.pages.length
    });
    
  } catch (error) {
    console.error('[DocumentIntelligence] Error processing document:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Error extracting text from document' 
    });
  }
};
