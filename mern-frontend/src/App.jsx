import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import RegistrationForm from "./components/RegistrationForm";
import Dashboard from "./components/Dashboard"; // new

import bgImage from "./assets/bg-dark.jpg";

function App() {
  return (
    <Router>
      <div
        className="app-container"
        style={{ backgroundImage: `url(${bgImage})` }}
      >
        <Routes>
          <Route path="/" element={<RegistrationForm />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
