const axios = require("axios");
const crypto = require("crypto");
const dalService = require("./dal.service");
/**
 * Verifies a signed identity using the SGX quote and Ed25519 public key.
 * @param {Object} inputJson - JSON object containing `response.quote`, `response.signature`, `response.identity`
 * @returns {Promise<boolean>} - True if valid, False otherwise
 */
async function verify(proofOfTask) {
    console.log("Starting verification", proofOfTask);
  
  try {
    const inputJson = await dalService.getIPfsTask(proofOfTask);
    console.log("in the verifificatin", inputJson);
    // Step 1: Extract fields
    const response = inputJson.response;
    const quote = response.quote;
    const signatureB64 = response.signature;
    const identity = response.identity;

    if (!quote || !signatureB64 || !identity) {
      throw new Error("Missing required field in input JSON");
    }

    // Step 2: Send quote to PCCS API
    const apiResp = await axios.post(
      "https://pccs.scrtlabs.com/dcap-tools/quote-parse",
      new URLSearchParams({ quote }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
      
    const reportDataHex = apiResp.data?.quote?.report_data;
    console.log("reportDataHex", reportDataHex);
    if (!reportDataHex) throw new Error("report_data missing in quote-parse response");

    // Step 3: Extract public key (first 32 bytes of report_data)
    const reportData = Buffer.from(reportDataHex, "hex");
    const pubKeyBytes = reportData.slice(0, 32);
    console.log("pubKeyBytes", pubKeyBytes);

    // Step 4: Wrap public key in DER prefix for Ed25519
    const derPrefix = Buffer.from("302a300506032b6570032100", "hex"); // ASN.1 header for Ed25519
    const spkiKey = Buffer.concat([derPrefix, pubKeyBytes]);
    console.log("spkiKey", spkiKey);

    // Step 5: Prepare message and decode signature
    const message = Buffer.from(JSON.stringify(identity, Object.keys(identity).sort()));
    const signature = Buffer.from(signatureB64, "base64");
    console.log("message", message);
    console.log("signature", signature);
    // Step 6: Verify signature
    const isValid = crypto.verify(null, message, {
      key: spkiKey,
      format: "der",
      type: "spki"
    }, signature);
    console.log("isValid", isValid);

    //Step 7: Verify that atesation fields match the known golden values:

    //MRTD: 1e305ac8284517f73ada985bfc9fded48b23ed091ba8149678bb10207fb470c7903d7a8ddffa5a7be2a60e349bb75b6e
    //RTMR0: 9e314df50e8cc934afb28ceb6c96987a04ffea8180037f0d8e12b9690c0d6d34131ecacfd752334d70a40aefce572259
    //RTMR1: 410195998b3b31a38c11c39f032d72f0fbf70ceddfb3ad3e217b0ca448bf3c134bde1155a2d2a03a1c44536ef3d5c3f8
    //RTMR2: 70d8b4dcffd9cdc555e08cb199ecc56cfac8b9904847def4c1ca68d5ae3b64ca7a7521055bde3acf906e00671c53376
    //RTMR3: 6fc36ad1ea30601a1df88681cc38d112a6226a18a6fbd92993aba19c82ca5f3e41503bd23e3525f24145e56196807754

    return isValid;
  } catch (err) {
    console.error("Verification error:", err.message);
    return false;
  }
}

module.exports = { verify };
