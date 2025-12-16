"use client"

import { useState, useEffect, useMemo } from "react"
import "./Dashboard.css"
import { RefreshCw } from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

/* ---------- Expandable Post ---------- */
const ExpandablePost = ({ text }) => {
  const [expanded, setExpanded] = useState(false)
  const MAX_LINES = 3

  const lines = text.split("\n")
  const MAX_CHARS = 150
  const isLong = text.length > MAX_CHARS

  const visibleText = expanded ? text : text.slice(0, MAX_CHARS) + (text.length > MAX_CHARS ? "..." : "")


  return (
    <div className="post">
      <pre className="post-text">{visibleText}</pre>
      {isLong && (
        <button
          className="more-btn"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </div>
  )
}

/* ---------- Dashboard ---------- */
const Dashboard = () => {
  const [trends, setTrends] = useState([])
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchTrends = async () => {
    const userId = localStorage.getItem("userId")
    if (!userId) return

    setIsLoading(true)
    try {
      const res = await fetch(
        `http://localhost:5000/api/fetch-trends?userId=${userId}&window=today`
      )
      if (!res.ok) throw new Error("Backend not responding")

      const data = await res.json()

      const normalized = (data.trends || []).map((t) => ({
        id: t.id,
        topic: t.topic,
        mentions: t.mentions ?? 0,
        sentiment: t.sentiment ?? 0,
        trendScore: t.trendScore ?? 0,
        lastUpdated: t.lastUpdated,
        history: Array.isArray(t.history) ? t.history : [],
        related: Array.isArray(t.related) ? t.related : [],
        posts: Array.isArray(t.posts) ? t.posts : [],
      }))

      setTrends(normalized)

      setPosts(
        normalized.flatMap((t) =>
          t.posts.map((text) => ({
            trend: t.topic,
            post: text,
          }))
        )
      )
    } catch (err) {
      console.warn("Fetch failed:", err.message)
      setTrends([])
      setPosts([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTrends()
  }, [])

  /* ---------- REAL trend history only ---------- */
  const trendHistory = useMemo(() => {
    if (!trends.length) return []

    const maxPoints = Math.max(
      ...trends.map((t) => t.history.length)
    )

    return Array.from({ length: maxPoints }, (_, i) => {
      const row = {}

      trends.forEach((t) => {
        const point = t.history[i]
        if (point) {
          row.time = new Date(point.ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
          row[t.topic] = point.score
        }
      })

      return row
    }).filter((r) => r.time)
  }, [trends])

  const getSentimentColor = (s) =>
    s >= 0.7 ? "#16a34a" : s >= 0.5 ? "#ca8a04" : "#dc2626"

  const getSentimentLabel = (s) =>
    s >= 0.7 ? "Positive" : s >= 0.5 ? "Neutral" : "Negative"

  const trendsWithRelated = trends.filter(
    (t) => t.related && t.related.length > 0
  )

  const lineColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Trend Dashboard</h1>
          <button
            onClick={fetchTrends}
            className="refresh-button"
            disabled={isLoading}
          >
            <RefreshCw size={18} className={isLoading ? "spinning" : ""} />
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="dashboard-grid">
          {/* Current Trends */}
          <div className="panel">
            <h2>Current Trends</h2>
            {trends.length === 0 && <p>No trends today</p>}
            {trends.map((t) => (
              <div key={t.id} className="trend-card">
                <h3>{t.topic}</h3>
                <p>Mentions: {t.mentions}</p>
                <p style={{ color: getSentimentColor(t.sentiment) }}>
                  {getSentimentLabel(t.sentiment)} ({t.sentiment.toFixed(2)})
                </p>
                <p>Score: {t.trendScore.toFixed(2)}</p>
              </div>
            ))}
          </div>

          {/* History */}
          <div className="panel">
            <h2>Trend Score History (Today)</h2>
            {trendHistory.length === 0 ? (
              <p>No history yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  {trends.map((t, i) => (
                    <Line
                      key={t.topic}
                      dataKey={t.topic}
                      stroke={lineColors[i % lineColors.length]}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Related Trends */}
          {trendsWithRelated.length > 0 && (
            <div className="panel">
              <h2>Related Trends</h2>
              {trendsWithRelated.map((t) => (
                <div key={t.id}>
                  <strong>{t.topic}</strong>
                  <div className="hashtag-tags">
                    {t.related.map((r) => (
                      <span key={r} className="hashtag-tag">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Posts */}
          <div className="panel">
            <h2>Current Reddit Posts</h2>
            {posts.length === 0 && <p>No posts today</p>}
            {posts.map((p, i) => (
              <div key={i} className="post-card">
                <strong>{p.trend}</strong>
                <ExpandablePost text={p.post} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
