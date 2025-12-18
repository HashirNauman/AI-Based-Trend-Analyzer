// mern-backend/jobs/ingestReddit.js
import cron from "node-cron"
import mongoose from "mongoose"
import dotenv from "dotenv"
import { collectRedditPosts } from "../services/redditCollector.js"

dotenv.config()

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/trendsdb"

async function connectDB() {
  await mongoose.connect(MONGO_URI)
  console.log("✅ MongoDB connected for Reddit ingestion")
}

async function start() {
  await connectDB()

  // Run immediately on startup (useful for dev/demo)
  console.log("🚀 Initial Reddit ingestion")
  await collectRedditPosts()

  // Run every 1 hours
  cron.schedule("0 */1 * * *", async () => {
    try {
      console.log("⏰ Running scheduled Reddit ingestion")
      await collectRedditPosts()
    } catch (err) {
      console.error("❌ Reddit ingestion failed:", err.message)
    }
  })
}

start()
