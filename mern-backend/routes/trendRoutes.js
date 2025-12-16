// mern-backend/routes/trendRoutes.js
import express from "express";
import Post from "../models/Post.js";
import Trend from "../models/Trend.js";
import User from "../models/User.js";
import { computeSentiment, computeTrendScore } from "../utils/trendUtils.js";
import { generateText } from "../utils/geminiClient.js";
import { collectRedditPosts, STOPWORDS } from "../services/redditCollector.js";
const router = express.Router();

/* =================== RELAXED CONSTANTS (SMALL DATA FRIENDLY) =================== */
const RELATED_LIMIT = 10;
const RELATED_DF_THRESHOLD = 0.99; // ⬅ relaxed
const MIN_TOKEN_LENGTH = 3;        // ⬅ allow shorter words

const norm = (s) => String(s || "").toLowerCase();
const INTEREST_SUBREDDIT_MAP = {
  AI: ["ArtificialIntelligence", "MachineLearning", "OpenAI", "LocalLLaMA"],
  Gaming: ["gaming", "pcgaming", "Games", "GameDev"],
  Climate: ["climate", "ClimateActionPlan", "environment", "climatechange"],
  Wildlife: ["Wildlife", "nature", "Conservation", "Ecology"],
  Sports: ["sports", "Cricket", "soccer", "WorldCup"],
};
/* ---------------- Gemini Filter ---------------- */
async function filterWithGemini(candidateTrends, topic) {
  if (!candidateTrends.length) return [];

  const prompt = `
You are filtering related trends.

Main topic: "${topic}"

Candidates:
${candidateTrends.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Rules:
- Remove generic words
- Keep concrete, meaningful trends
- Return a JSON array (mini 2,max 3 items)
- NO explanation, JSON ONLY
`;

  try {
    const text = await generateText(prompt, 150);
    if (!text) return [];

    const clean = text.trim().replace(/```json|```/g, "");
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed.slice(0, 3) : [];
  } catch (err) {
    console.error("❌ Gemini parsing failed:", err.message);
    return [];
  }
}

/* ---------------- POST /api/posts ---------------- */
router.post("/posts", async (req, res) => {
  try {
    const { platform, text, hashtags = [], author, meta } = req.body;
    if (!platform || !text)
      return res.status(400).json({ message: "platform and text required" });

    const sentiment = computeSentiment(text);

    const post = await Post.create({
      platform,
      text,
      hashtags: hashtags.map(norm),
      author,
      sentiment,
      meta,
    });

    res.status(201).json({ message: "Post stored", postId: post._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------- GET /api/fetch-trends ---------------- */
router.get("/fetch-trends", async (req, res) => {
  try {
    const { userId, window = "today", top = 10 } = req.query;
    if (!userId) return res.status(400).json({ message: "userId required" });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    let since;
    if (window === "today") {
      const now = new Date();
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else {
      const mins = Number(window);
      if (isNaN(mins) || mins <= 0)
        return res.status(400).json({ message: "Invalid window" });
      since = new Date(Date.now() - mins * 60000);
    }

    const interestTags = [];
user.interests.forEach((i) => {
  interestTags.push(i.toLowerCase()); // main interest
  if (INTEREST_SUBREDDIT_MAP[i]) {
    INTEREST_SUBREDDIT_MAP[i].forEach((sub) => interestTags.push(sub.toLowerCase()));
  }
});
    const baseMatch = {
      createdAt: { $gte: since },
      platform: user.platformPreference,
      hashtags: { $in: interests },
    };

    /* ---- Aggregate main trends ---- */
    const aggregated = await Post.aggregate([
      { $match: baseMatch },
      { $unwind: "$hashtags" },
      { $addFields: { hashtagNorm: { $toLower: "$hashtags" } } },
      { $match: { hashtagNorm: { $in: interests } } },
      {
        $group: {
          _id: "$hashtagNorm",
          mentions: { $sum: 1 },
          avgSentiment: { $avg: "$sentiment" },
          posts: { $push: "$text" },
        },
      },
      { $sort: { mentions: -1 } },
      { $limit: Number(top) },
    ]);

    const posts = await Post.find(baseMatch).limit(300).lean();

    /* ---- DF calculation (robust) ---- */
    const df = {};
    posts.forEach((p) => {
      const tags =
        p.derivedTags?.length > 0
          ? p.derivedTags
          : (p.text || "")
              .toLowerCase()
              .replace(/[^a-z\s]/g, " ")
              .split(/\s+/)
              .filter(
                (t) =>
                  t.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(t)
              );

      [...new Set(tags.map(norm))].forEach(
        (h) => (df[h] = (df[h] || 0) + 1)
      );
    });

    const totalDocs = posts.length || 1;

    const trends = await Promise.all(
      aggregated.map(async (item) => {
        const prev = await Trend.findOne({ topic: item._id });

        const score = computeTrendScore(
          item.mentions,
          prev?.mentionCount || 0,
          item.avgSentiment || 0
        );

        /* ---- Compute related trends (FIXED) ---- */
        const relatedScores = {};

        posts.forEach((p) => {
          if (!p.hashtags?.map(norm).includes(item._id)) return;

          const tags =
            p.derivedTags?.length > 0
              ? p.derivedTags
              : (p.text || "")
                  .toLowerCase()
                  .replace(/[^a-z\s]/g, " ")
                  .split(/\s+/)
                  .filter(
                    (t) =>
                      t.length >= MIN_TOKEN_LENGTH &&
                      !STOPWORDS.has(t)
                  );

          [...new Set(tags.map(norm))].forEach((h) => {
            if (
              h !== item._id &&
              (df[h] || 0) / totalDocs < RELATED_DF_THRESHOLD
            ) {
              relatedScores[h] =
                (relatedScores[h] || 0) +
                Math.log(1 + totalDocs / ((df[h] || 1)));
            }
          });
        });

        /* ---- NO MIN SCORE FILTER (important) ---- */
        const candidates = Object.entries(relatedScores)
          .sort((a, b) => b[1] - a[1])
          .slice(0, RELATED_LIMIT)
          .map(([tag]) => tag);

        /* ---- DO NOT OVERWRITE WITH EMPTY ---- */
        const finalRelated =
          prev?.related?.length > 0 ? prev.related : candidates;

        const geminiFiltered =
          prev?.filteredRelated?.length > 0
            ? prev.filteredRelated
            : await filterWithGemini(candidates, item._id);

        const finalFiltered =
          geminiFiltered.length > 0 ? geminiFiltered : finalRelated.slice(0, 3);

        /* ---- Persist ---- */
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
            $push: {
              history: { ts: new Date(), count: item.mentions, score },
            },
          },
          { upsert: true, new: true }
        );

        return {
          id: trendDoc._id,
          topic: trendDoc.topic,
          mentions: trendDoc.mentionCount,
          sentiment: trendDoc.avgSentiment,
          trendScore: trendDoc.score,
          lastUpdated: trendDoc.lastUpdated,
          history: trendDoc.history.slice(-10),
          posts: item.posts.slice(-5),
          related: trendDoc.filteredRelated,
        };
      })
    );

    res.json({
      userId,
      platform: user.platformPreference,
      interests: user.interests,
      window,
      trends,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ---------------- POST /api/run-reddit-collector ---------------- */
router.post("/run-reddit-collector", async (req, res) => {
  try {
    await collectRedditPosts();
    res.json({ message: "Reddit ingestion + trend update completed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
