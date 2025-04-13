// import { HfInference, InferenceClient } from "@huggingface/inference";
// import axios from "axios";
// import { ChromaClient } from "chromadb";
// import dotenv from "dotenv";
// import path from 'path';
// import pdfExtract from 'pdf-extraction';
// import { pipeline } from '@xenova/transformers';


// // const pdfPath = path.resolve( '/home/kali/test-app/South_Africa_2012-en.pdf');


// // dotenv.config();

// // let embeddingModel;

// // // Load once and reuse
// // async function loadEmbeddingModel() {
// //     if (!embeddingModel) {
// //         embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
// //     }
// //     return embeddingModel;
// // }

// // let qaPipeline;
// // async function initModel() {
// //   if (!qaPipeline) {
// //     qaPipeline = await pipeline('question-answering', 'Xenova/distilbert-base-cased-distilled-squad');
// //   }
// // }
// // // const hf = new InferenceClient(process.env.HUGGINGFACE_API_KEY); // Add your Hugging Face API key to a .env file
// // const chroma = new ChromaClient();
// // const collectionName = "archives";


// async function setupChroma(){

//     // Check if the collection already exists
//     const existingCollections = await chroma.listCollections();

//     if (existingCollections.includes(collectionName)) {
//         return await chroma.getCollection({name: collectionName}); // Reuse the existing collection
//     }

//     console.log("Creating collection:", collectionName);
//     const collection = await chroma.createCollection({
//         name: collectionName,
//         embeddingFunction: {
//             model: "sentence-transformers/all-MiniLM-L6-v2",
//             type: "huggingface",
//         },
//         persist: true,
//     });
//     return collection;
// }

// // // async function generateEmbedding(text){
// // //     const result = await hf.featureExtraction({
// // //         inputs: text,
// // //         model: "sentence-transformers/all-MiniLM-L6-v2",
// // //     });
// // //     return result;
// // // }

// export async function generateEmbedding(text) {
//     if (typeof text !== 'string') {
//         console.warn("generateEmbedding: Non-string input detected. Converting to string.");
//         text = String(text);
//     }
//     const model = await loadEmbeddingModel();
//     const output = await model(text, { pooling: 'mean', normalize: true });
//     const embeddingArray = Array.from(output.data);
//     console.log("Embedding array:", embeddingArray);

//     return embeddingArray;
// }


// async function storeData(collection, id, text){
//     const embedding = await generateEmbedding(text);
//     await collection.add({
//         ids: [id],
//         embeddings: [embedding],
//         metadatas : [{ text }],
//     });
// }

// async function generateResponse(query, collection) {
//   const qa = await pipeline('question-answering', 'Xenova/distilbert-base-uncased-distilled-squad');
//     if (typeof query !== 'string') query = String(query);
//     const embedding = await generateEmbedding(query);
//     const results = await collection.query({
//         queryEmbeddings: [embedding],
//         nResults: 3,
//     });

//     if (!results || !results.metadatas || results.metadatas.length === 0) {
//         return "No relevant information found.";
//     }

//     // `metadatas` is an array of arrays: [ [ {...}, {...}, {...} ] ]
//     const metadataArray = results.metadatas[0].slice(0, 3); // Limit to the top 3 pieces of context

//     if (!metadataArray || metadataArray.length === 0) {
//         return "No relevant metadata found.";
//     }

//     var context = metadataArray.map((metadata) => metadata.text).join("\n");
//     if (typeof context !== 'string') context = String(context);
//     const maxContextLength = 1000; // Approximate token limit
//     if (context.length > maxContextLength) {
//         context = context.slice(0, maxContextLength);
//     }


//     // console.log("Final context sample:", context.slice(0, 300));

//     // return result.generated_text;
//     console.log("Question type:", typeof query, "Value:", query);
//     console.log("Context type:", typeof context, "Length:", context.length);

//     const response = await qa(
//         query,
//         context
//     );
//     console.log("Response type:", typeof response.answer, "Value:", response.answer);
//     return response.answer
// }

// // (async () => {
// //     const collection = await setupChroma();

// //     // Query and generate a response
// //     const query = "what laws protect the homeless?";
// //     const response = await generateResponse(query, collection);
// //     console.log("AI Response:", response);
// //   })();



// // // async function generateHaiku() {
// // //   const result = await hf.textGeneration({
// // //     inputs: "Write a haiku about AI:",
// // //     parameters: {
// // //       temperature: 0.7,   // Adjust creativity
// // //     },
// // //   });

// // //   console.log(result.generated_text);
// // }

// // // generateHaiku();

// // const cleanPDFText = (rawText) => {
// //     // Remove irrelevant metadata
// //     const withoutMetadata = rawText.replace(/PDF generated:.*\n/g, '');
// //     const withoutProjectInfo = withoutMetadata.replace(/constituteproject\.org/g, '');
// //     const withoutPageNumbers = withoutProjectInfo.replace(/\bPage \d+\b/g, '');
// //     const withoutTableOfContents = withoutPageNumbers.replace(/Table of contents[\s\S]*?(\n\d+\n|$)/, '');
    
// //     // Clean further by removing excess chapter numbering and other redundant text
// //     const cleanedText = withoutTableOfContents.replace(/^\d+\.\s+/, ''); // Clean chapter numbers
// //     return cleanedText;
// // };
  

// // // Function to extract text from a PDF file
// async function extractTextFromPDF(pdfPath) {
//     try {
//         const options = { splitPages: false }; // Configure the extraction options
//         const extracted = await pdfExtract(pdfPath, options);
//         extracted.text = cleanPDFText(extracted.text); // Clean the extracted text
//         return extracted.text;
//     } catch (error) {
//         console.error('Error reading PDF:', error);
//     }
// }




// // // (async () => {
// // //     const collection = await setupChroma();
// // //     const pdfText = await extractTextFromPDF(pdfPath);
// // //     

// // //     // Split the text into chunks

// // //     // Store each chunk in Chroma
// // //     for (let i = 0; i < chunks.length; i++) {
// // //         const chunk = chunks[i];
// // //         // console.log(`Storing chunk ${i + 1}/${chunks.length}`);
// // //         await storeData(collection, `pdf_chunk_${i + 1}`, chunk);
// // //     }

// // //     console.log("PDF content stored in Chroma.");
// // // })();



// const run = async () => {
//   const qa = await pipeline('question-answering', 'Xenova/distilbert-base-uncased-distilled-squad');

//   const question = "What is the capital of France?";
//   const context = "France is a country in Europe. Its capital is Paris.";

//   console.log("Input to pipeline:");
//   console.log({ question, context });

//   try{  const result = await qa(
//     // {
//     //     question: question,
//     //     context: context,
//     // }
//     question, context
//                               );
//     console.log(result);

//     }catch(err){
//         console.error("Error in pipeline:", err);
//         return;
//     }

// };

// run();



import { pipeline } from '@xenova/transformers';
import pdfExtract from 'pdf-extraction';
import { ChromaClient } from 'chromadb';
import path from 'path';

const chroma = new ChromaClient();
const collectionName = "pdf_data";

// Function to extract text from a PDF file
async function extractTextFromPDF(pdfPath) {
    try {
        const options = { splitPages: false }; // Configure the extraction options
        const extracted = await pdfExtract(pdfPath, options);
        return extracted.text;
    } catch (error) {
        console.error('Error reading PDF:', error);
        return null;
    }
}

// Function to clean the extracted text
function cleanPDFText(rawText) {
  const withoutMetadata = rawText.replace(/PDF generated:.*\n/g, '');
  const withoutProjectInfo = withoutMetadata.replace(/constituteproject\.org/g, '');
  const withoutPageNumbers = withoutProjectInfo.replace(/\bPage \d+\b/g, '');
  const withoutTableOfContents = withoutPageNumbers.replace(/Table of contents[\s\S]*?(\n\d+\n|$)/, '');
  const withoutSpecialChars = withoutTableOfContents.replace(/[^\w\s.,!?]/g, ''); // Remove special characters
  const cleanedText = withoutSpecialChars.replace(/\s+/g, ' ').trim(); // Remove extra spaces
  return cleanedText;
}

// Function to split text into chunks
// function splitTextIntoChunks(text, chunkSize = 500) {
//   const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]; // Split by sentences
//   const chunks = [];
//   let currentChunk = '';

//   for (const sentence of sentences) {
//       if ((currentChunk + sentence).length > chunkSize) {
//           chunks.push(currentChunk.trim());
//           currentChunk = sentence;
//       } else {
//           currentChunk += ' ' + sentence;
//       }
//   }
//   if (currentChunk) {
//       chunks.push(currentChunk.trim());
//   }

//   return chunks;
// }

function splitTextIntoChunks(text, chunkSize = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}
// Function to store chunks in Chroma
async function storeChunksInChroma(chunks) {
  let collection;

  // Check if the collection already exists
  const existingCollections = await chroma.listCollections();
  if (existingCollections.includes(collectionName)) {
      console.log(`Reusing existing collection: ${collectionName}`);
      collection = await chroma.getCollection({ name: collectionName });
  } else {
      console.log(`Creating new collection: ${collectionName}`);
      collection = await chroma.createCollection({
          name: collectionName,
          embeddingFunction: {
              model: "sentence-transformers/all-MiniLM-L6-v2",
              type: "huggingface",
          },
          persist: true,
      });
  }

  // Add chunks to the collection
  for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await collection.add({
          ids: [`chunk_${i}`],
          embeddings: [await generateEmbedding(chunk)],
          metadatas: [{ text: chunk }],
      });
  }
  console.log("Chunks stored in Chroma.");
  return collection;
}
// Function to generate embeddings
async function generateEmbedding(text) {
    const model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    const output = await model(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

async function summarizeContext(context) {
  const summarizer = await pipeline('summarization', 'facebook/bart-large-cnn');
  const summary = await summarizer(context, { max_length: 150, min_length: 50, do_sample: false });
  return summary[0].summary_text;
}

// Function to query the stored data
async function queryChroma(query, collection) {
    const embedding = await generateEmbedding(query);
    const results = await collection.query({
        queryEmbeddings: [embedding],
        nResults: 5,
    });

    if (!results || !results.metadatas || results.metadatas.length === 0) {
        return "No relevant information found.";
    }

    // Xenova/distilbert-base-uncased-distilled-squad -- works
    // deepset/roberta-base-squad2 -- testable
    // Xenova/bert-large-uncased-whole-word-masking-squad2 -- testable

    // Rank chunks by similarity
    const rankedChunks = results.metadatas[0]
    .map((metadata, index) => ({ text: metadata.text, score: results.distances[0][index] }))
    .sort((a, b) => a.score - b.score); // Lower distance = higher relevance

    // Combine the top-ranked chunks into a single context
    const context = rankedChunks.slice(0, 3).map((chunk) => chunk.text).join("\n");

    // const context = results.metadatas[0].map((metadata) => metadata.text).join("\n");
    // context = await summarizeContext(context); // Summarize the context if needed
    const qa = await pipeline('question-answering', 'Xenova/distilbert-base-uncased-distilled-squad');
    const response = await qa(
        query,
        context,
    );

    return response;
}

// Main function
const run = async () => {
    const pdfPath = path.resolve('/home/kali/test-app/South_Africa_2012-en.pdf');
    const rawText = await extractTextFromPDF(pdfPath);

    if (!rawText) {
        console.error("Failed to extract text from PDF.");
        return;
    }

    const cleanedText = cleanPDFText(rawText);
    const chunks = splitTextIntoChunks(cleanedText);
    const collection = await storeChunksInChroma(chunks);

    const query = "what laws protect me against unfair dismissal?";
    const answer = await queryChroma(query, collection);


    console.log("Query:", query);
    console.log("Answer:", answer.answer);
};

run();