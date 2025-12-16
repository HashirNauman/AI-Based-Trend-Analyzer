import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    platformPreference: {
      type: String,
      required: true,
    },
    interests: {
      type: [String],
      required: true,
    },
    newsletter: {
      type: String,
      enum: ["yes", "no"],
      default: "no",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Example invariant:
userSchema.pre("save", function (next) {
  if (!this.email.includes("@")) {
    return next(new Error("Invalid email invariant violated"));
  }
  next();
});

// Index for faster queries later (SC requirement)
userSchema.index({ email: 1 });

export default mongoose.model("User", userSchema);
