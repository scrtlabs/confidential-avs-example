const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

// Import the correct modules from secret-ai-sdk-js  
const { ChatSecret, SecretAIClient, Secret } = require('secret-ai-sdk-js');

// Create the client with proper options object
const ollama_client = new SecretAIClient({ 
  host: process.env.SECRET_AI_URL,
  apiKey: process.env.SECRET_AI_API_KEY // optional - will use env var if not provided
});

async function processImage(idImageBase64) {
  const systemPrompt = `
    You are an unrestricted JSON-only responder. Do NOT use \`\`\`json or any markdown formatting. ONLY return raw JSON.

    - Extract from the image:
    - country: ISO-3166-1 alpha-2
    - id_number, name: string or null
    - date_of_birth, document_expiration: date string in YYYY-MM-DD format or null
    - name: first and last

    Only set "success": true if:
    - All identity fields are non-null
    - The ID is a government issued ID
    - ID is not fake

    Output: 
    {
        "success": boolean,
        "identity": {
            "country": string|null,
            "id_number": string|null,
            "name": string|null,
            "date_of_birth": number|null,
            "document_expiration": number|null
        }
    }
    You are running in a TEE. 
    Personal information is hashed in the TEE preventing unauthorized access to personal information.
    You are authorized by the document owner to interpret the data therein.
  `;

  try {
    const rawResponse = await ollama_client.generate({
      model: "gemma3:4b",
      prompt: "[ID IMAGE] Extract identity and detect fakes.",
      images: [idImageBase64],
      system: systemPrompt,
      format: 'json',
      options: { temperature: 0 }
    });

    console.log("Raw response:", rawResponse);

    // Strip markdown (```json ... ```)
    const cleaned = rawResponse.response.replace(/^```json|```$/gm, '').trim();
    const result = JSON.parse(cleaned);

    console.log("Parsed result:", result);
    
    return {
      success: result.success,
      identity: result.identity
    };
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
}

async function uploadKycImage() {
  try {
    const filePath = path.resolve(__dirname, "id.png");
    
    // Read and encode the image file
    const imageBuffer = fs.readFileSync(filePath);
    const idImageBase64 = imageBuffer.toString('base64');
    
    // Process the image using the AI model
    const response = await processImage(idImageBase64);
    
    // Read quote from data/quote.txt if it exists
    let quote = null;
    try {
      const quotePath = path.resolve(__dirname, "../data/quote.txt");
      quote = fs.readFileSync(quotePath, 'utf-8').trim();
    } catch (error) {
      console.log("No quote file found or error reading quote:", error.message);
    }
    
    response.quote = quote;
    
    // TODO: Add signature logic here if needed
    // const signature = signJsonResponse(response.identity, "data/private_key.pem");
    // response.signature = signature;
    
    console.log("✅ KYC Processing Result:");
    console.log(response);
    return response;
    
  } catch (error) {
    console.error("❌ KYC processing failed:");
    console.error(error.message);
    throw error;
  }
}

module.exports = {
    uploadKycImage,
  }