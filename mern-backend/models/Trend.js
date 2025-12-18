// mern-backend/models/Trend.js
import mongoose from "mongoose"

const trendSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true, index: true },
    topHashtags: { type: [String], default: [] },
    platforms: { type: [String], default: [] },
    mentionCount: { type: Number, default: 0 },
    avgSentiment: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    related: { type: [String], default: [] }, // TF-IDF candidates
    filteredRelated: { type: [String], default: [] }, // Gemini-filtered
    history: [
      {
        ts: { type: Date, required: true },
        count: { type: Number, required: true },
        score: { type: Number, required: true, default: 0 }, // Score field included in history
      },
    ],
    lastUpdated: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
)

// index to support fetching recent trends quickly
trendSchema.index({ lastUpdated: -1, score: -1 })

export default mongoose.model("Trend", trendSchema)
