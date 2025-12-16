// mern-backend/utils/trendUtils.js
import Sentiment from "sentiment";
import { generateText } from "./geminiClient.js";

const sentimentAnalyzer = new Sentiment();

/**
 * computeSentiment: analyze a text and return normalized score -1..1
 */
export function computeSentiment(text) {
  if (!text || typeof text !== "string") return 0;
  const r = sentimentAnalyzer.analyze(text);
  // r.score is unbounded int (positive/negative). Normalize by dividing by length heuristic.
  const norm = r.score / Math.max(1, Math.sqrt(text.length));
  // clamp to -1..1
  return Math.max(-1, Math.min(1, norm));
}

/**
 * computeTrendScore: combine growth and sentiment into single score (0..100)
 * recentCount: mentions in recent window
 * previousCount: mentions in previous window
 * avgSentiment: -1..1
 */
export function computeTrendScore(recentCount, previousCount, avgSentiment) {
  const growth = previousCount === 0 ? recentCount : (recentCount - previousCount) / (previousCount || 1);
  // growth factor: saturate
  const growthFactor = Math.tanh(growth); // -1..1
  // sentiment factor: -1..1
  const sentimentFactor = avgSentiment;
  // combine with weights: growth weight 0.7, sentiment weight 0.3
  const raw = 0.7 * growthFactor + 0.3 * sentimentFactor;
  // map -1..1 -> 0..100
  const score = Math.round(((raw + 1) / 2) * 100);
  return Math.max(0, Math.min(100, score));
}

/**
 * parseDSLFilter - ultra-small DSL parser for queries like:
 * "TREND WHERE sentiment > 0.2 AND platform = 'Twitter'"
 * returns an object filter for Mongo queries (supports sentiment and platform)
 */
export function parseDSLFilter(dsl) {
  if (!dsl || typeof dsl !== "string") return {};
  // naive approach: look for keywords
  const filter = {};
  const lower = dsl.toLowerCase();
  const platformMatch = dsl.match(/platform\s*=\s*['"]?([a-zA-Z0-9_ -]+)['"]?/i);
  if (platformMatch) filter.platform = platformMatch[1];
  const sentimentMatch = dsl.match(/sentiment\s*([<>]=?)\s*([0-9.]+)/i);
  if (sentimentMatch) {
    const op = sentimentMatch[1];
    const val = parseFloat(sentimentMatch[2]);
    if (!isNaN(val)) {
      if (op === ">") filter.avgSentiment = { $gt: val };
      else if (op === "<") filter.avgSentiment = { $lt: val };
      else if (op === ">=") filter.avgSentiment = { $gte: val };
      else if (op === "<=") filter.avgSentiment = { $lte: val };
    }
  }
  return filter;
}

/**
 * Example recursive function: recursively traverse nested comments
 * (This demonstrates recursion requirement.)
 */
export function countCommentsRecursive(node) {
  if (!node) return 0;
  if (!node.replies || node.replies.length === 0) return 1;
  let count = 1;
  node.replies.forEach((r) => {
    count += countCommentsRecursive(r);
  });
  return count;
}
/**
 * filterWithGemini
 * Uses Gemini to filter semantically related trends
 */
export async function filterWithGemini(candidates = [], topic) {
  if (!candidates.length) return [];

  const prompt = `
You are an AI that filters topic-related keywords.

Main topic: "${topic}"

Candidate related keywords:
${candidates.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Return ONLY a valid JSON array of the most relevant keywords.
No explanation, no markdown, no extra text.
`;

  try {
    const text = await generateText(prompt, 200);
    if (!text) return [];

    // Defensive cleanup
    const clean = text.trim().replace(/```json|```/g, "");

    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("❌ Gemini filtering failed:", err.message);
    return [];
  }
}
