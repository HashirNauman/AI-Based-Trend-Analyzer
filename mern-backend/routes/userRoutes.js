// mern-backend/routes/userRoutes.js
import express from "express";
import User from "../models/User.js";

const router = express.Router();

/* =========================================================
   POST /api/register
   Create a new user
========================================================= */
router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      platformPreference,
      interests,
      newsletter = "no",
    } = req.body;

    // Validation
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

    // Check duplicate email
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      password, // plaintext (intentionally, per project scope)
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

/* =========================================================
   POST /api/login
   Simple email + password login
========================================================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user || user.password !== password) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    return res.json({
      message: "Login successful",
      userId: user._id,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/* =========================================================
   GET /api/users/:id
   Fetch user preferences (used by dashboard & trends)
========================================================= */
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

/* =========================================================
   PUT /api/users/:id/preferences
   Update platform, interests, newsletter
========================================================= */
router.put("/users/:id/preferences", async (req, res) => {
  try {
    const { platformPreference, interests, newsletter } = req.body;

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
        newsletter: newsletter ?? "no",
      },
      { new: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "Preferences updated successfully",
      user: updated,
    });
  } catch (err) {
    console.error("Update preferences error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
