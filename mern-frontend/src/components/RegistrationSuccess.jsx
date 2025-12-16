import React from "react";
import "./RegistrationSuccess.css";

const RegistrationSuccess = () => {
  return (
    <div className="success-page">
      <div className="success-card">
        <h1>Registration Complete</h1>
        <p>Your account has been successfully created.</p>

        <a href="/" className="success-btn">
          Go to Homepage
        </a>
      </div>
    </div>
  );
};

export default RegistrationSuccess;
