import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import trendRoutes from "./routes/trendRoutes.js";
import "./jobs/ingestReddit.js";

const app = express();
const PORT = process.env.PORT || 5000;

// Connect DB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", userRoutes);
app.use("/api", trendRoutes);

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
