"use client"

import { useState } from "react"
import "./RegistrationForm.css"
import { Eye, EyeOff } from "lucide-react"
import { useNavigate } from "react-router-dom"

const interestsList = ["AI", "Gaming", "Wildlife", "Climate", "Sports"]
const platformsList = ["Reddit", "Zwitter", "Festagram"]

const RegistrationForm = () => {
  const navigate = useNavigate()

  const [isLogin, setIsLogin] = useState(false)
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    platformPreference: "",
    interests: [],
    newsletter: "no",
  })

  const [errors, setErrors] = useState({})
  const [showPassword, setShowPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  /* =========================================================
     Validation helpers
  ========================================================= */
  const validateEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const validateForm = () => {
    const newErrors = {}

    if (!isLogin && !formData.fullName.trim())
      newErrors.fullName = "Full name is required"

    if (!formData.email.trim())
      newErrors.email = "Email is required"
    else if (!validateEmail(formData.email))
      newErrors.email = "Invalid email address"

    if (!formData.password)
      newErrors.password = "Password is required"
    else if (!isLogin && formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters"

    if (!isLogin && !formData.platformPreference)
      newErrors.platformPreference = "Select a platform"

    if (!isLogin && formData.interests.length === 0)
      newErrors.interests = "Select at least one interest"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /* =========================================================
     Handlers
  ========================================================= */
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name])
      setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const handleInterestChange = (interest) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }))
    if (errors.interests)
      setErrors((prev) => ({ ...prev, interests: undefined }))
  }

  const handleNewsletterChange = (value) => {
    setFormData((prev) => ({ ...prev, newsletter: value }))
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
      const endpoint = isLogin
        ? "http://localhost:5000/api/login"
        : "http://localhost:5000/api/register"

      const payload = isLogin
        ? { email: formData.email, password: formData.password }
        : formData

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || "Request failed")
      }

      if (data.userId) {
        localStorage.setItem("userId", data.userId)
        setSuccessMessage(
          isLogin ? "✓ Login successful!" : "✓ Registration successful!"
        )

        setTimeout(() => navigate("/dashboard"), 800)
      }
    } catch (err) {
      console.error("Auth error:", err)
      setSuccessMessage(
        `✗ ${isLogin ? "Login" : "Registration"} failed`
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  /* =========================================================
     UI
  ========================================================= */
  return (
    <div className="form-container">
      <div className="form-wrapper">
        <div className="form-header">
          <h1 className="form-title">
            {isLogin ? "Welcome Back" : "Advanced Trend Analyzer Registration"}
          </h1>
          <p className="form-subtitle">
            {isLogin
              ? "Sign in to access your trend dashboard"
              : "Sign up to start tracking micro-trends"}
          </p>
        </div>

        {successMessage && (
          <div
            className={`success-message ${
              successMessage.startsWith("✗") ? "error" : "success"
            }`}
          >
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="registration-form">
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">
                Full Name <span className="required">*</span>
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                className={`form-input ${
                  errors.fullName ? "input-error" : ""
                }`}
              />
              {errors.fullName && (
                <span className="error-message">{errors.fullName}</span>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Email <span className="required">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className={`form-input ${
                errors.email ? "input-error" : ""
              }`}
            />
            {errors.email && (
              <span className="error-message">{errors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">
              Password <span className="required">*</span>
            </label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`form-input ${
                  errors.password ? "input-error" : ""
                }`}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((p) => !p)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
          </div>

          {!isLogin && (
            <>
              {/* Platform */}
              <div className="form-group">
                <label className="form-label">
                  Platform Preference <span className="required">*</span>
                </label>
                <select
                  name="platformPreference"
                  value={formData.platformPreference}
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
              </div>

              {/* Interests */}
              <div className="form-group">
                <label className="form-label">
                  Interests <span className="required">*</span>
                </label>
                <div className="checkbox-group">
                  {interestsList.map((i) => (
                    <label key={i}>
                      <input
                        type="checkbox"
                        checked={formData.interests.includes(i)}
                        onChange={() => handleInterestChange(i)}
                      />
                      {i}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="submit-button"
          >
            {isSubmitting
              ? "Processing..."
              : isLogin
              ? "Sign In"
              : "Create Account"}
          </button>
        </form>

        <div className="form-toggle">
          <p>
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setErrors({})
                setSuccessMessage("")
              }}
              className="toggle-button"
            >
              {isLogin ? "Sign Up" : "Log In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

export default RegistrationForm
