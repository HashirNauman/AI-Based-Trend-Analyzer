// mern-backend/models/Post.js
import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true, index: true }, // Twitter, Reddit, etc.
    text: { type: String, required: true },
    hashtags: { type: [String], default: [], index: true },
    author: { type: String },
    sentiment: { type: Number, default: null }, // -1..1 scaled
    meta: { type: mongoose.Schema.Types.Mixed }, // any extra data
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Helpful compound index for queries by time + hashtag
postSchema.index({ createdAt: 1, hashtags: 1 });

export default mongoose.model("Post", postSchema);
