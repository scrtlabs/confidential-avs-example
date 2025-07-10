const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
require('dotenv').config();

// Import the correct modules from secret-ai-sdk-js  
const { ChatSecret, SecretAIClient, Secret } = require('secret-ai-sdk');

const MODEL = "gemma3:4b";

// Initialize Secret client and get URL
async function initializeSecretClient() {
  const secret_client = new Secret();

  let models = await secret_client.getModels();
  console.log(`Models: ${models}`);

  let urls = await secret_client.getUrls();
  console.log(`Urls: ${urls}`);

  const SECRET_AI_URL = urls[0];
  console.log(`SECRET_AI_URL: ${SECRET_AI_URL}`);
  
  return new SecretAIClient({ 
    host: SECRET_AI_URL,
    apiKey: process.env.SECRET_AI_API_KEY // optional - will use env var if not provided
  });
}

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
    // Initialize the client each time or consider caching it
    const ollama_client = await initializeSecretClient();


    console.log("Get response from model", MODEL);
    
    const rawResponse = await ollama_client.generate({
      model: MODEL,
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

    // Age verification logic
    let over_18 = false;
    let over_21 = false;
    
    if (result.identity && result.identity.date_of_birth) {
      const currentDate = new Date();
      let birthDate;
      
      // Handle different date formats
      if (typeof result.identity.date_of_birth === 'number') {
        // If it's a timestamp (in milliseconds) or year
        if (result.identity.date_of_birth > 1900 && result.identity.date_of_birth < 2100) {
          // Assume it's a year, set to January 1st of that year
          birthDate = new Date(result.identity.date_of_birth, 0, 1);
        } else {
          // Assume it's a timestamp
          birthDate = new Date(result.identity.date_of_birth);
        }
      } else if (typeof result.identity.date_of_birth === 'string') {
        // If it's a date string
        birthDate = new Date(result.identity.date_of_birth);
      }
      
      if (birthDate && !isNaN(birthDate.getTime())) {
        const ageInMilliseconds = currentDate - birthDate;
        const ageInYears = ageInMilliseconds / (1000 * 60 * 60 * 24 * 365.25);
        
        over_18 = ageInYears >= 18;
        over_21 = ageInYears >= 21;
        
        console.log(`Age verification: ${ageInYears.toFixed(1)} years old, over_18: ${over_18}, over_21: ${over_21}`);
      } else {
        console.log("Invalid date of birth format, cannot verify age");
      }
    } else {
      console.log("No date of birth provided, cannot verify age");
    }
    
    return {
      success: result.success,
      id_number: result.identity?.id_number || null,
      country: result.identity?.country || null,
      over_18: over_18,
      over_21: over_21
    };
  } catch (error) {
    console.error("Error processing image:", error);
    throw error;
  }
}

async function uploadKycImage(fileBuffer = null) {
  try {
    let imageBuffer;
    
    if (fileBuffer) {
      // Use the provided file buffer
      imageBuffer = fileBuffer;
    } else {
      // Fallback to reading the local file
      const filePath = path.resolve(__dirname, "id.png");
      imageBuffer = fs.readFileSync(filePath);
    }
    
    // Encode the image file
    const idImageBase64 = imageBuffer.toString('base64');
    
    // Process the image using the AI model
    const response = await processImage(idImageBase64);


    const testQuotePath = path.resolve(__dirname, "../data/quote.txt");
    const prodQuotePath = path.resolve("./crypto/docker_attestation_ed25519.txt");

    let quotePath;
    try {
      if (fs.existsSync(prodQuotePath)) {
        quotePath = prodQuotePath;
      } else {
        quotePath = testQuotePath;
      }
    } catch (error) {
      console.log("Error checking quote paths:", error.message);
      quotePath = testQuotePath;
    }
    
    // Read quote from data/quote.txt if it exists
    let quote = null;
    try {
      quote = fs.readFileSync(quotePath, 'utf-8').trim();
    } catch (error) {
      console.log("No quote file found or error reading quote:", error.message);
    }
    
    response.quote = quote;

    const testPrivateKeyPath = path.resolve(__dirname, "../data/private_key.pem");
    const prodPrivateKeyPath = path.resolve("./crypto/docker_private_key_ed25519.pem");

    let privateKeyPath;
    try {
      if (fs.existsSync(prodPrivateKeyPath)) {
        privateKeyPath = prodPrivateKeyPath;
      } else {
        privateKeyPath = testPrivateKeyPath;
      }
    } catch (error) {
      console.log("Error checking private key paths:", error.message);
      privateKeyPath = testPrivateKeyPath;
    }
    
    
    const signature = signJsonResponse({
      id_number: response.id_number,
      over_18: response.over_18,
      over_21: response.over_21
    }, privateKeyPath);
    response.signature = signature;
    
    console.log("✅ KYC Processing Result:");
    console.log(response);
    return response;
    
  } catch (error) {
    console.error("❌ KYC processing failed:");
    console.error(error.message);
    throw error;
  }
}

function signJsonResponse(jsonData, privateKeyPath) {
    const crypto = require('crypto');
    
    // Handle null or undefined jsonData
    if (!jsonData || typeof jsonData !== 'object') {
        throw new Error('Invalid jsonData provided to signJsonResponse');
    }
    
    // Serialize JSON data with sorted keys (equivalent to Python's sort_keys=True)
    const message = JSON.stringify(jsonData, Object.keys(jsonData).sort());
    
    // Load private key from PEM file
    const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf-8');
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    
    // Sign the message
    const signature = crypto.sign(null, Buffer.from(message, 'utf-8'), privateKey);
    
    // Return base64-encoded signature
    return signature.toString('base64');
}

module.exports = {
    uploadKycImage,
}