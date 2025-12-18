"use client"

import { useState, useEffect } from "react"
import "./PreferencesPanel.css"

const interestsList = ["AI", "Gaming", "Wildlife", "Climate", "Sports"]
const platformsList = ["Reddit", "Zwitter", "Festagram"]

const PreferencesPanel = ({ userId, onPreferencesUpdated }) => {
  const [preferences, setPreferences] = useState({
    platformPreference: "",
    interests: [],
    newsletter: "no",
  })

  const [errors, setErrors] = useState({})
  const [successMessage, setSuccessMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  /* =========================================================
     Load existing preferences
  ========================================================= */
  useEffect(() => {
    if (!userId) return

    const loadPreferences = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`http://localhost:5000/api/users/${userId}`)
        if (!res.ok) throw new Error("Failed to load preferences")

        const data = await res.json()

        setPreferences({
          platformPreference: data.platformPreference || "",
          interests: Array.isArray(data.interests) ? data.interests : [],
          newsletter: data.newsletter || "no",
        })
      } catch (err) {
        console.error("Load preferences error:", err)
        setSuccessMessage("✗ Failed to load preferences")
      } finally {
        setIsLoading(false)
      }
    }

    loadPreferences()
  }, [userId])

  /* =========================================================
     Validation
  ========================================================= */
  const validateForm = () => {
    const newErrors = {}

    if (!preferences.platformPreference) {
      newErrors.platformPreference = "Select a platform"
    }

    if (!preferences.interests.length) {
      newErrors.interests = "Select at least one interest"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /* =========================================================
     Handlers
  ========================================================= */
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setPreferences((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleInterestChange = (interest) => {
    setPreferences((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }))

    if (errors.interests) {
      setErrors((prev) => ({ ...prev, interests: undefined }))
    }
  }

  const handleNewsletterChange = (value) => {
    setPreferences((prev) => ({ ...prev, newsletter: value }))
  }

  /* =========================================================
     Submit
  ========================================================= */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setSuccessMessage("")

    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      const res = await fetch(
        `http://localhost:5000/api/users/${userId}/preferences`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preferences),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Update failed")
      }

      setSuccessMessage("✓ Preferences updated successfully!")

      // Trigger callback to parent (Dashboard)
      if (onPreferencesUpdated) {
        onPreferencesUpdated()
      }

    } catch (err) {
      console.error("Update preferences error:", err)
      setSuccessMessage("✗ Failed to update preferences")
    } finally {
      setIsSubmitting(false)
    }
  }

  /* =========================================================
     UI
  ========================================================= */
  return (
    <div className="preferences-panel-wrapper">
      <h2>Platform Preferences & Interests</h2>
      <p className="preferences-subtitle">
        Customize your trend tracking experience
      </p>

      {successMessage && (
        <div
          className={`success-message ${
            successMessage.startsWith("✗") ? "error" : "success"
          }`}
        >
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <p>Loading preferences...</p>
      ) : (
        <form onSubmit={handleSubmit} className="preferences-form">
          {/* Platform Preference */}
          <div className="form-group">
            <label htmlFor="platformPreference" className="form-label">
              Platform Preference <span className="required">*</span>
            </label>
            <select
              id="platformPreference"
              name="platformPreference"
              value={preferences.platformPreference}
              onChange={handleInputChange}
              className={`form-select ${
                errors.platformPreference ? "input-error" : ""
              }`}
            >
              <option value="">Choose a platform...</option>
              {platformsList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {errors.platformPreference && (
              <span className="error-message">
                {errors.platformPreference}
              </span>
            )}
          </div>

          {/* Interests */}
          <div className="form-group">
            <label className="form-label">
              Interests / Topics <span className="required">*</span>
            </label>
            <div className="checkbox-group">
              {interestsList.map((interest) => (
                <label key={interest} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={preferences.interests.includes(interest)}
                    onChange={() => handleInterestChange(interest)}
                  />
                  <span>{interest}</span>
                </label>
              ))}
            </div>
            {errors.interests && (
              <span className="error-message">{errors.interests}</span>
            )}
          </div>

          {/* Newsletter */}
          <div className="form-group">
            <label className="form-label">
              Subscribe to Newsletter <span className="required">*</span>
            </label>
            <div className="radio-group">
              {["yes", "no"].map((value) => (
                <label key={value} className="radio-label">
                  <input
                    type="radio"
                    name="newsletter"
                    value={value}
                    checked={preferences.newsletter === value}
                    onChange={(e) =>
                      handleNewsletterChange(e.target.value)
                    }
                  />
                  <span>
                    {value === "yes"
                      ? "Yes, subscribe me"
                      : "No, thanks"}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`submit-button ${
              isSubmitting ? "submitting" : ""
            }`}
          >
            {isSubmitting ? "Saving..." : "Save Preferences"}
          </button>
        </form>
      )}
    </div>
  )
}

export default PreferencesPanel
