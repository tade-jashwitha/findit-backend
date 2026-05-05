// utils/vision.js — Computer Vision Integration
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Setup Gemini client (Placeholder for AppDeaser in the future)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy");

/**
 * Extracts visual features from an image URL using a Computer Vision model.
 * Currently uses Google Gemini Vision, easily swappable to AppDeaser.
 * 
 * @param {string} imageUrl - The Cloudinary image URL
 * @param {string} mimeType - The image mime type (e.g., "image/jpeg")
 * @returns {Promise<Array<string>>} - Array of detected feature tags
 */
async function extractImageFeatures(imageUrl, mimeType = "image/jpeg") {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  GEMINI_API_KEY is not set. Skipping image detection.");
    return [];
  }

  try {
    // 1. Fetch the image as a buffer
    const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const base64Image = Buffer.from(imageResponse.data).toString("base64");

    // 2. Prepare the prompt for the vision model
    const prompt = `Analyze this image of a lost/found item. 
Extract 5 to 8 distinct physical features (like colors, brand, material, unique marks, patterns).
Respond ONLY with a valid JSON array of lowercase strings.
Example: ["black", "leather", "nike", "silver zipper", "scratched"]`;

    // 3. Call the Vision API
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Image, mimeType } },
    ]);

    const rawText = result.response.text();
    
    // 4. Parse the JSON response
    try {
      const tags = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      return Array.isArray(tags) ? tags : [];
    } catch (e) {
      console.error("Failed to parse vision tags:", rawText);
      return [];
    }
  } catch (err) {
    console.error("Image Detection Error:", err.message);
    return [];
  }
}

module.exports = { extractImageFeatures };
