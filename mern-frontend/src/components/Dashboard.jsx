"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
import PreferencesPanel from "./PreferencesPanel"

/* ---------- Expandable Post ---------- */
const ExpandablePost = ({ text }) => {
  const [expanded, setExpanded] = useState(false)
  const MAX_CHARS = 150

  const isLong = text.length > MAX_CHARS
  const visibleText = expanded || !isLong ? text : text.slice(0, MAX_CHARS) + "..."

  return (
    <div className="post">
      <pre className="post-text">{visibleText}</pre>
      {isLong && (
        <button className="more-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "less" : "more"}
        </button>
      )}
    </div>
  )
}

/* ---------- Dashboard ---------- */
const Dashboard = () => {
  const [userId, setUserId] = useState(null)
  const [trends, setTrends] = useState([])
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentView, setCurrentView] = useState("trends")

  // Persistent history to avoid resetting chart
  const [historyStore, setHistoryStore] = useState({})
  const [preferencesVersion, setPreferencesVersion] = useState(0) // triggers trend refresh

  /* ---------- Read userId ONCE ---------- */
  useEffect(() => {
    const id = localStorage.getItem("userId")
    if (id) setUserId(id)
  }, [])

  /* ---------- Fetch Trends ---------- */
  const fetchTrends = useCallback(
    async (silent = false) => {
      if (!userId) return
      if (!silent) setIsLoading(true)

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

        // Update current snapshot
        setTrends(normalized)
        setPosts(
          normalized.flatMap((t) =>
            t.posts.map((text) => ({
              trend: t.topic,
              post: text,
            }))
          )
        )

        // Merge history into frontend store (avoid duplicates)
        setHistoryStore((prev) => {
          const next = { ...prev }

          normalized.forEach((t) => {
            next[t.topic] ??= {}

            t.history.forEach((h) => {
              const ts = new Date(h.ts)
              ts.setSeconds(0, 0) // round to nearest minute
              const key = ts.getTime()
              if (next[t.topic][key] == null) {
                next[t.topic][key] = h.score
              }
            })
          })

          return next
        })
      } catch (err) {
        console.warn("Fetch failed:", err.message)
      } finally {
        if (!silent) setIsLoading(false)
      }
    },
    [userId]
  )

  /* ---------- Initial fetch + polling + refresh on preferences change ---------- */
  useEffect(() => {
    if (!userId) return

    fetchTrends() // initial fetch
    const interval = setInterval(() => fetchTrends(true), 60_000) // poll every minute
    return () => clearInterval(interval)
  }, [userId, fetchTrends, preferencesVersion])

  /* ---------- Build FULL-DAY trend history for chart ---------- */
  const trendHistory = useMemo(() => {
    const topics = Object.keys(historyStore)
    if (!topics.length) return []

    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const rows = []
    const lastValue = {}

    for (let t = start.getTime(); t <= now.getTime(); t += 60_000) {
      const row = { time: t }
      topics.forEach((topic) => {
        if (historyStore[topic]?.[t] != null) {
          lastValue[topic] = historyStore[topic][t]
        }
        row[topic] = lastValue[topic] ?? null
      })
      rows.push(row)
    }

    return rows
  }, [historyStore])

const getSentimentLabel = (s) =>
  s > 0.05 ? "Positive" : s < -0.05 ? "Negative" : "Neutral"

const getSentimentColor = (s) =>
  s > 0.05 ? "#16a34a" : s < -0.05 ? "#dc2626" : "#ca8a04"

  const trendsWithRelated = trends.filter((t) => t.related?.length)

  const lineColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

  const views = [
    { id: "trends", label: "Current Trends" },
    { id: "history", label: "Trend Score History" },
    { id: "related", label: "Related Trends" },
    { id: "posts", label: "Reddit Posts" },
    { id: "preferences", label: "Preferences" },
  ]

  /* ---------- Preferences callback ---------- */
  const handlePreferencesUpdated = () => {
    setPreferencesVersion((v) => v + 1) // triggers re-fetch trends
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Trend Dashboard</h1>
        </div>
        <div className="header-controls">
          <div className="view-buttons">
            {views.map((view) => (
              <button
                key={view.id}
                onClick={() => setCurrentView(view.id)}
                className={`view-button ${
                  currentView === view.id ? "active" : ""
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchTrends()}
            className="refresh-button"
            disabled={isLoading || !userId}
          >
            <RefreshCw size={18} className={isLoading ? "spinning" : ""} />
            {isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div className="dashboard-content">
          {/* Current Trends View */}
          {currentView === "trends" && (
            <div className="panel view-panel">
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
          )}

          {/* Trend History View */}
          {currentView === "history" && (
            <div className="panel view-panel">
              <h2>Trend Score History (Today)</h2>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={trendHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(ts) =>
                      new Date(ts).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  {Object.keys(historyStore).map((topic, i) => (
                    <Line
                      key={topic}
                      dataKey={topic}
                      stroke={lineColors[i % lineColors.length]}
                      dot={false}
                      type="monotone"
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Related Trends View */}
          {currentView === "related" && (
            <div className="panel view-panel">
              <h2>Related Trends</h2>
              {trendsWithRelated.length === 0 && <p>No related trends available</p>}
              {trendsWithRelated.map((t) => (
                <div key={t.id} className="related-trend-group">
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

          {/* Posts View */}
          {currentView === "posts" && (
            <div className="panel view-panel">
              <h2>Current Reddit Posts</h2>
              {posts.length === 0 && <p>No posts today</p>}
              <div className="posts-list">
                {posts.map((p, i) => (
                  <div key={i} className="post-card">
                    <strong>{p.trend}</strong>
                    <ExpandablePost text={p.post} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preferences View */}
          {currentView === "preferences" && (
            <div className="panel view-panel">
              <PreferencesPanel
                userId={userId}
                onPreferencesUpdated={handlePreferencesUpdated}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
