// mern-backend/routes/userRoutes.js
import express from "express";
import User from "../models/User.js";

const router = express.Router();

/**
 * POST /api/register
 * Creates a new user
 */
router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      platformPreference,
      interests,
      newsletter = false,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !password ||
      !platformPreference ||
      !Array.isArray(interests) ||
      interests.length === 0
    ) {
      return res.status(400).json({
        message: "Missing or invalid required fields",
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const user = await User.create({
      fullName,
      email,
      password, // yes it's plaintext, no we are not fixing auth right now
      platformPreference,
      interests,
      newsletter,
    });

    return res.status(201).json({
      message: "User registered successfully",
      userId: user._id,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/users/:id
 * Returns user preferences (used by frontend + trend system)
 */
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(user);
  } catch (err) {
    console.error("Fetch user error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/users/:id/preferences
 * Update platform + interests
 */
router.put("/users/:id/preferences", async (req, res) => {
  try {
    const { platformPreference, interests } = req.body;

    if (
      !platformPreference ||
      !Array.isArray(interests) ||
      interests.length === 0
    ) {
      return res.status(400).json({
        message: "platformPreference and interests are required",
      });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      {
        platformPreference,
        interests,
      },
      { new: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "Preferences updated",
      user: updated,
    });
  } catch (err) {
    console.error("Update preferences error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
