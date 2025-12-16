// src/RootLayout.jsx
import React from "react";
import "./global.css"; // renamed from app/global.css

export default function RootLayout({ children }) {
  return (
    <div className="app-container">
      {children}
    </div>
  );
}
