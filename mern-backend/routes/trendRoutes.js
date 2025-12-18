// mern-backend/routes/trendRoutes.js
import express from "express"
import Post from "../models/Post.js"
import Trend from "../models/Trend.js"
import User from "../models/User.js"
import { computeSentiment, computeTrendScore } from "../utils/trendUtils.js"
import { generateText } from "../utils/geminiClient.js"
import { collectRedditPosts, STOPWORDS } from "../services/redditCollector.js"
import {filterWithGemini} from "../utils/trendUtils.js"
const router = express.Router()

/* =================== RELAXED CONSTANTS =================== */
const RELATED_LIMIT = 10
const RELATED_DF_THRESHOLD = 0.99
const MIN_TOKEN_LENGTH = 3

const norm = (s) => String(s || "").toLowerCase()



/* ---------------- POST /api/posts ---------------- */
router.post("/posts", async (req, res) => {
  try {
    const { platform, text, hashtags = [], author, meta } = req.body
    if (!platform || !text) return res.status(400).json({ message: "platform and text required" })

    const sentiment = computeSentiment(text)

    const post = await Post.create({
      platform,
      text,
      hashtags: hashtags.map(norm),
      author,
      sentiment,
      meta,
    })

    res.status(201).json({ message: "Post stored", postId: post._id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server error" })
  }
})

/* ---------------- GET /api/fetch-trends ---------------- */
router.get("/fetch-trends", async (req, res) => {
  try {
    const { userId, window = "today", top = 10 } = req.query
    if (!userId) return res.status(400).json({ message: "userId required" })

    const user = await User.findById(userId).lean()
    if (!user) return res.status(404).json({ message: "User not found" })

    /* ---------- Determine time window ---------- */
    let since
    if (window === "today") {
      const now = new Date()
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    } else {
      const mins = Number(window)
      if (isNaN(mins) || mins <= 0) return res.status(400).json({ message: "Invalid window" })
      since = new Date(Date.now() - mins * 60000)
    }

    /* ---------- Interest hashtags ---------- */
    const interestTags = user.interests.map(norm)

    const baseMatch = {
      createdAt: { $gte: since },
      platform: user.platformPreference,
      hashtags: { $in: interestTags },
    }

    /* ---------- Aggregate main trends (weighted mentions) ---------- */
    const aggregated = await Post.aggregate([
      { $match: baseMatch },
      { $unwind: "$hashtags" },
      { $addFields: { hashtagNorm: { $toLower: "$hashtags" } } },
      { $match: { hashtagNorm: { $in: interestTags } } },
      {
        $group: {
          _id: "$hashtagNorm",
          mentions: {
            $sum: {
              $ln: {
                $add: [
                  1,
                  { $ifNull: ["$meta.ups", 0] },
                  { $ifNull: ["$meta.num_comments", 0] },
                ],
              },
            },
          },
          avgSentiment: { $avg: "$sentiment" },
          posts: { $push: "$text" },
        },
      },
      { $sort: { mentions: -1 } },
      { $limit: Number(top) },
    ])

    const posts = await Post.find(baseMatch).limit(300).lean()

    // ⬇️ Compute total engagement for trend scoring
    const totalEngagement = posts.reduce(
      (sum, p) => sum + (p.meta?.ups || 0) + (p.meta?.num_comments || 0),
      0
    )

    /* ---------- Compute document frequency ---------- */
    const df = {}
    posts.forEach((p) => {
      const tags =
        p.derivedTags?.length > 0
          ? p.derivedTags
          : (p.text || "")
              .toLowerCase()
              .replace(/[^a-z\s]/g, " ")
              .split(/\s+/)
              .filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t))
      ;[...new Set(tags.map(norm))].forEach((h) => {
        df[h] = (df[h] || 0) + 1
      })
    })

    const totalDocs = posts.length || 1

    /* ---------- Compute trends and related ---------- */
    const trends = await Promise.all(
      aggregated.map(async (item) => {
        const prev = await Trend.findOne({ topic: item._id }).lean()
        const prevEntry = prev?.history?.slice(-1)[0]
        const prevMentionCount = prevEntry?.count || 0

        const score = computeTrendScore(
          item.mentions,
          prevMentionCount,
          item.avgSentiment || 0,
          totalEngagement
        )

        /* ---------- Related scores ---------- */
        const relatedScores = {}
        posts.forEach((p) => {
          if (!p.hashtags?.map(norm).includes(item._id)) return

          const tags =
            p.derivedTags?.length > 0
              ? p.derivedTags
              : (p.text || "")
                  .toLowerCase()
                  .replace(/[^a-z\s]/g, " ")
                  .split(/\s+/)
                  .filter((t) => t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t))
          ;[...new Set(tags.map(norm))].forEach((h) => {
            if (h !== item._id && (df[h] || 0) / totalDocs < RELATED_DF_THRESHOLD) {
              relatedScores[h] = (relatedScores[h] || 0) + Math.log(1 + totalDocs / (df[h] || 1))
            }
          })
        })

        const candidates = Object.entries(relatedScores)
          .sort((a, b) => b[1] - a[1])
          .slice(0, RELATED_LIMIT)
          .map(([tag]) => tag)

        const finalRelated = candidates.slice(0, 3)
        const geminiFiltered = await filterWithGemini(candidates, item._id)
        const finalFiltered = geminiFiltered.length > 0 ? geminiFiltered : finalRelated

        const trendDoc = await Trend.findOneAndUpdate(
          { topic: item._id },
          {
            $set: {
              topic: item._id,
              mentionCount: item.mentions,
              avgSentiment: item.avgSentiment,
              score,
              lastUpdated: new Date(),
              related: finalRelated,
              filteredRelated: finalFiltered,
            },
          },
          { upsert: true, new: true }
        )

        return {
          id: trendDoc._id,
          topic: trendDoc.topic,
          mentions: trendDoc.mentionCount,
          sentiment: trendDoc.avgSentiment,
          trendScore: trendDoc.score,
          lastUpdated: trendDoc.lastUpdated,
          history: trendDoc.history.filter(
            (h) => new Date(h.ts) >= new Date(new Date().setHours(0, 0, 0, 0))
          ),
          posts: item.posts.slice(-5),
          related: trendDoc.filteredRelated,
        }
      })
    )

    res.json({
      userId,
      platform: user.platformPreference,
      interests: user.interests,
      window,
      trends,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server error" })
  }
})

/* ---------------- POST /api/run-reddit-collector ---------------- */
router.post("/run-reddit-collector", async (req, res) => {
  try {
    await collectRedditPosts()
    res.json({ message: "Reddit ingestion + trend update completed" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Server error" })
  }
})

export default router
