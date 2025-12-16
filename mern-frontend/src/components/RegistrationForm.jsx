import React, { useState } from "react";
import "./RegistrationForm.css";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

const interestsList = ["AI", "Gaming", "Wildlife", "Climate", "Sports"];
const platformsList = ["Reddit", "Zwitter", "Festagram"];

const RegistrationForm = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    platformPreference: "",
    interests: [],
    newsletter: "no",
  });

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const validateForm = () => {
    const newErrors = {};

    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!validateEmail(formData.email)) newErrors.email = "Invalid email address";

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters";

    if (!formData.platformPreference)
      newErrors.platformPreference = "Select a platform";

    if (formData.interests.length === 0)
      newErrors.interests = "Select at least one interest";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleInterestChange = (interest) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
    if (errors.interests)
      setErrors((prev) => ({ ...prev, interests: undefined }));
  };

  const handleNewsletterChange = (value) =>
    setFormData((prev) => ({ ...prev, newsletter: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage("");

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
  const response = await fetch("http://localhost:5000/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = null; }

  if (response.ok && data?.userId) {
  localStorage.setItem("userId", data.userId);
  setSuccessMessage("✓ Registration successful!");
  setFormData({
    fullName: "",
    email: "",
    password: "",
    platformPreference: "",
    interests: [],
    newsletter: "no",
  });
  setTimeout(() => navigate("/dashboard"), 1000);
} else if (response.status === 409) {
  setSuccessMessage("✗ Email already registered. Try logging in.");
} else {
  setSuccessMessage(`✗ Registration failed: ${data?.message || "Unknown error"}`);
}

} catch (err) {
  console.error(err);
  setSuccessMessage("✗ Connection error. Check your connection.");
}
 finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="form-container">
      <div className="form-wrapper">
        <div className="form-header">
          <h1 className="form-title">Advanced Trend Analyzer Registration</h1>
          <p className="form-subtitle">Sign up to start tracking micro-trends and generating content.</p>
        </div>

        {successMessage && (
          <div className={`success-message ${successMessage.includes("✗") ? "error" : "success"}`}>
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="registration-form">
          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="fullName" className="form-label">
              Full Name <span className="required">*</span>
              <span className="char-counter">{formData.fullName.length}/50</span>
            </label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              placeholder="Enter your full name"
              maxLength={50}
              className={`form-input ${errors.fullName ? "input-error" : ""}`}
              aria-invalid={!!errors.fullName}
              title="Your full name for account identification"
            />
            {errors.fullName && <span className="error-message">{errors.fullName}</span>}
          </div>

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email <span className="required">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="your@email.com"
              className={`form-input ${errors.email ? "input-error" : ""}`}
              aria-invalid={!!errors.email}
              title="We'll use this to send you trend updates and insights"
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password <span className="required">*</span>
              <span className="password-length">{formData.password.length > 0 && `${formData.password.length}/20`}</span>
            </label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Minimum 8 characters"
                maxLength={20}
                className={`form-input ${errors.password ? "input-error" : ""}`}
                aria-invalid={!!errors.password}
                title="Create a strong password with at least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {/* Platform Preference */}
          <div className="form-group">
            <label htmlFor="platformPreference" className="form-label">
              Platform Preference <span className="required">*</span>
            </label>
            <select
              id="platformPreference"
              name="platformPreference"
              value={formData.platformPreference}
              onChange={handleInputChange}
              className={`form-select ${errors.platformPreference ? "input-error" : ""}`}
              aria-invalid={!!errors.platformPreference}
              title="Select your primary social media platform for trend analysis"
            >
              <option value="">Choose a platform...</option>
              {platformsList.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {errors.platformPreference && <span className="error-message">{errors.platformPreference}</span>}
          </div>

          {/* Interests */}
          <div className="form-group">
            <label className="form-label">
              Interests/Topics <span className="required">*</span>
            </label>
            <div className="checkbox-group">
              {interestsList.map(interest => (
                <label key={interest} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.interests.includes(interest)}
                    onChange={() => handleInterestChange(interest)}
                    className="checkbox-input"
                    title={`I'm interested in ${interest} trends`}
                  />
                  <span className="checkbox-text">{interest}</span>
                </label>
              ))}
            </div>
            {errors.interests && <span className="error-message">{errors.interests}</span>}
          </div>

          {/* Newsletter */}
          <div className="form-group">
            <label className="form-label">
              Subscribe to Newsletter <span className="required">*</span>
            </label>
            <div className="radio-group">
              {["yes", "no"].map(value => (
                <label key={value} className="radio-label">
                  <input
                    type="radio"
                    name="newsletter"
                    value={value}
                    checked={formData.newsletter === value}
                    onChange={e => handleNewsletterChange(e.target.value)}
                    className="radio-input"
                    title={value === "yes" ? "Receive weekly trend analysis emails" : "Don't send me newsletter emails"}
                  />
                  <span className="radio-text">{value === "yes" ? "Yes, subscribe me" : "No, thanks"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`submit-button ${isSubmitting ? "submitting" : ""}`}
          >
            {isSubmitting ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="form-footer">
          By registering, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default RegistrationForm;
