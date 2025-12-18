// mern-backend/models/Post.js
import mongoose from "mongoose"

const postSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true, index: true },
    text: { type: String, required: true },
    hashtags: { type: [String], default: [], index: true },
    author: { type: String },
    sentiment: { type: Number, default: null },

    meta: {
      redditId: { type: String, index: true },
      subreddit: String,
      url: String,
      ups: { type: Number, default: 0 },
      num_comments: { type: Number, default: 0 },
    },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
)

postSchema.index({ createdAt: 1, hashtags: 1 })

export default mongoose.model("Post", postSchema)
