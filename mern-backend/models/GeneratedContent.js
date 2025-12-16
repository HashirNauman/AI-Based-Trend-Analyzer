// mern-backend/models/GeneratedContent.js
import mongoose from "mongoose";

const generatedSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["hashtags", "posts"], required: true },
    topic: { type: String, required: true, index: true },
    platform: { type: String },
    payload: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: String }, // user id or system
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

generatedSchema.index({ topic: 1, type: 1 });

export default mongoose.model("GeneratedContent", generatedSchema);
