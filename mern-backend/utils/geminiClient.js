// mern-backend/utils/geminiClient.js
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite-001",
];

/**
 * generateText: try primary -> secondary -> tertiary
 * @param {string} prompt
 * @param {number} maxTokens
 */
export async function generateText(prompt, maxTokens = 300) {
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        maxOutputTokens: maxTokens,
      });
      if (response.text) return response.text;
    } catch (err) {
      console.warn(`${model} failed: ${err.message}, trying next model...`);
    }
  }
  return "";
}
