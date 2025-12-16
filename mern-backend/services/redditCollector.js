// mern-backend/services/redditCollector.js
import axios from "axios";
import Post from "../models/Post.js";
import Trend from "../models/Trend.js";
import { computeSentiment } from "../utils/trendUtils.js";
import { filterWithGemini } from "../utils/trendUtils.js"; // move Gemini filtering to utils

export const INTEREST_SUBREDDIT_MAP = {
  AI: ["ArtificialIntelligence", "MachineLearning", "OpenAI", "LocalLLaMA"],
  Gaming: ["gaming", "pcgaming", "Games", "GameDev"],
  Climate: ["climate", "ClimateActionPlan", "environment", "climatechange"],
  Wildlife: ["Wildlife", "nature", "Conservation", "Ecology"],
  Sports: ["sports", "Cricket", "soccer", "WorldCup"],
};

const PLATFORM = "Reddit";

export const STOPWORDS = new Set([
  "the","is","are","to","of","and","a","in","for","on","with","this","that","it",
  "as","by","from","at","an","be","has","have","or","but","they","their","them",
  "into","about","note","major","https","http","www","com","reddit","post","comments",
  "i","me","my","myself","we","our","ours","ourselves","you","your","yours","yourself","yourselves",
  "he","him","his","himself","she","her","hers","herself","it","its","itself","they","them","their",
  "theirs","themselves","what","which","who","whom","this","that","these","those","am","is","are",
  "was","were","be","been","being","have","has","had","having","do","does","did","doing","a","an",
  "the","and","but","if","or","because","as","until","while","of","at","by","for","with","about",
  "against","between","into","through","during","before","after","above","below","to","from","up",
  "down","in","out","on","off","over","under","again","further","then","once","here","there","when",
  "where","why","how","all","any","both","each","few","more","most","other","some","such","no","nor",
  "not","only","own","same","so","than","too","very","s","t","can","will","just","don","should","now",
  "though", "back", "keep"
]);

async function fetchSubredditPosts(subreddit, limit = 10) {
  try {
    const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;
    const resp = await axios.get(url, { headers: { "User-Agent": "TrendBot/1.0" } });
    return resp.data.data.children.map((c) => c.data);
  } catch (err) {
    console.error(`❌ Error fetching r/${subreddit}:`, err.message);
    return [];
  }
}

function normalizeToken(token) {
  const corrections = { aquires: "acquires", acquireing: "acquiring", games: "game", models: "model" };
  if (corrections[token]) return corrections[token];
  if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
  return token;
}

/* ---------------- DerivedTags Extraction ---------------- */
function extractDerivedTags(text, max = 10) {
  const tokens = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter(t => t.length > 4 && !STOPWORDS.has(t) && !/^\d+$/.test(t));

  return [...new Set(tokens)].slice(0, max);
}

function extractKeywords(text, max = 6) {
  const tokens = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter(t => t.length > 4 && !STOPWORDS.has(t) && !/^\d+$/.test(t));

  const freq = {};
  tokens.forEach((t, i) => {
    freq[t] = (freq[t] || 0) + (i < 15 ? 2 : 1);
  });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
}

function normalizePost(redditPost, interest) {
  const text = redditPost.title + (redditPost.selftext ? "\n"+redditPost.selftext : "");
  const extractedKeywords = extractKeywords(text, 6);
  const derivedTags = extractDerivedTags(text);

  return {
    platform: PLATFORM,
    text,
    hashtags: [interest.toLowerCase()],
    derivedTags,
    author: redditPost.author,
    sentiment: computeSentiment(text),
    meta: {
      redditId: redditPost.id,
      subreddit: redditPost.subreddit,
      url: "https://reddit.com" + redditPost.permalink
    }
  };
}

/* ---------------- Update Trends After Post Ingestion ---------------- */
async function updateTrendsForInterest(interest) {
  const topic = interest.toLowerCase();
  const posts = await Post.find({ hashtags: topic }).lean();
  if (!posts.length) return;

  const df = {};
  posts.forEach(p => {
    [...new Set(p.derivedTags || [])].forEach(h => {
      df[h] = (df[h] || 0) + 1;
    });
  });

  const totalDocs = posts.length;
  const scores = {};
  posts.forEach(p => {
    if (!p.hashtags?.map(t => t.toLowerCase()).includes(topic)) return;
    [...new Set(p.derivedTags || [])].forEach(h => {
      if (h !== topic && !STOPWORDS.has(h) && h.length > 4 && df[h] / totalDocs < 0.85) {
        scores[h] = (scores[h] || 0) + Math.log(1 + totalDocs / (df[h] || 1));
      }
    });
  });

  const candidates = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([h]) => h);

  const filtered = await filterWithGemini(candidates, topic);

  await Trend.findOneAndUpdate(
    { topic },
    { related: candidates, filteredRelated: filtered },
    { upsert: true }
  );
}

/* ---------------- Collect Reddit Posts ---------------- */
export async function collectRedditPosts(interests) {
  const activeInterests = interests?.length ? interests : Object.keys(INTEREST_SUBREDDIT_MAP);
  const insertedSummary = {};

  for (const interest of activeInterests) {
    let inserted = 0;
    const subreddits = INTEREST_SUBREDDIT_MAP[interest] || [];

    for (const sub of subreddits) {
      const posts = await fetchSubredditPosts(sub, 10);

      for (const redditPost of posts) {
        try {
          const exists = await Post.findOne({ "meta.redditId": redditPost.id });
          if (exists) continue;
          const normalized = normalizePost(redditPost, interest);
          await Post.create(normalized);
          inserted++;
          console.log(`+ Added: ${redditPost.title} [r/${sub}]`);
        } catch (err) {
          console.error("❌ Error saving post:", err.message);
        }
      }
    }

    insertedSummary[interest] = inserted;

    // ---------------- Trigger trend computation immediately ----------------
    await updateTrendsForInterest(interest);
  }

  console.log(`✅ RedditCollector finished. Total new posts per interest:`, insertedSummary);
  return insertedSummary;
}
