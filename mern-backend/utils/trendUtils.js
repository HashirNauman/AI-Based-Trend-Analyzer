// mern-backend/utils/trendUtils.js
import Sentiment from "sentiment"
import { generateText } from "./geminiClient.js"

const sentimentAnalyzer = new Sentiment()

/**
 * computeSentiment: analyze a text and return normalized score -1..1
 */
export function computeSentiment(text) {
  if (!text || typeof text !== "string") return 0
  const r = sentimentAnalyzer.analyze(text)
  // r.score is unbounded int (positive/negative). Normalize by dividing by length heuristic.
  const norm = r.score / Math.max(1, Math.sqrt(text.length))
  // clamp to -1..1
  return Math.max(-1, Math.min(1, norm))
}

/**
 * computeTrendScore
 * Combines growth, velocity, sentiment, and engagement into a 0..100 score
 *
 * @param {number} recent - current mention count
 * @param {number} prev - previous window mention count
 * @param {number} sentiment - average sentiment (-1..1)
 * @param {number} engagement - total engagement (ups + comments), optional
 */
export function computeTrendScore(recent, prev, sentiment, engagement = 1) {
  // Growth rate (handles cold start)
  const growthRate =
    prev > 0 ? (recent - prev) / prev : Math.log1p(recent)

  // Velocity = how fast topic is moving right now
  const velocity = Math.log1p(recent)

  // Weighted components
  const growthComponent = 0.4 * Math.tanh(growthRate)
  const velocityComponent = 0.3 * Math.tanh(velocity / 5)
  const sentimentComponent = sentiment * 0.3
  const engagementComponent =
  Math.tanh(Math.log1p(engagement) / 5) * 0.4


  const raw =
    growthComponent +
    velocityComponent +
    sentimentComponent +
    engagementComponent

  // Normalize from (-1..~2) → (0..100)
  const clamped = Math.max(-1, Math.min(1, raw))
const normalized = ((clamped + 1) / 2) * 100


  return Math.max(0, Math.min(100, Math.round(normalized)))
}

/**
 * parseDSLFilter - ultra-small DSL parser for queries like:
 * "TREND WHERE sentiment > 0.2 AND platform = 'Twitter'"
 * returns an object filter for Mongo queries (supports sentiment and platform)
 */
export function parseDSLFilter(dsl) {
  if (!dsl || typeof dsl !== "string") return {}
  // naive approach: look for keywords
  const filter = {}
  const lower = dsl.toLowerCase()
  const platformMatch = dsl.match(/platform\s*=\s*['"]?([a-zA-Z0-9_ -]+)['"]?/i)
  if (platformMatch) filter.platform = platformMatch[1]
  const sentimentMatch = dsl.match(/sentiment\s*([<>]=?)\s*([0-9.]+)/i)
  if (sentimentMatch) {
    const op = sentimentMatch[1]
    const val = Number.parseFloat(sentimentMatch[2])
    if (!isNaN(val)) {
      if (op === ">") filter.avgSentiment = { $gt: val }
      else if (op === "<") filter.avgSentiment = { $lt: val }
      else if (op === ">=") filter.avgSentiment = { $gte: val }
      else if (op === "<=") filter.avgSentiment = { $lte: val }
    }
  }
  return filter
}

/**
 * Example recursive function: recursively traverse nested comments
 * (This demonstrates recursion requirement.)
 */
export function countCommentsRecursive(node) {
  if (!node) return 0
  if (!node.replies || node.replies.length === 0) return 1
  let count = 1
  node.replies.forEach((r) => {
    count += countCommentsRecursive(r)
  })
  return count
}
/* ---------------- Gemini Filter ---------------- */
export async function filterWithGemini(candidateTrends, topic) {
  if (!candidateTrends.length) return []

  const prompt = `
You are filtering related trends.

Main topic: "${topic}"

Candidates:
${candidateTrends.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Rules:
- Remove generic words
- Keep concrete, meaningful trends
- Return a JSON array (minimum 2,maximum 4 items)
- NO explanation, JSON ONLY
`

  try {
    const text = await generateText(prompt, 150)
    if (!text) return []

    const clean = text.trim().replace(/```json|```/g, "")
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? parsed.slice(0, 3) : []
  } catch (err) {
    console.error("❌ Gemini parsing failed:", err.message)
    return []
  }
}