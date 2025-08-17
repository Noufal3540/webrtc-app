import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthApp from './AuthApp';
// Remove the index.css import if you don't have the file

// Protected Route Component
const ProtectedRoute = ({ children, isAuthenticated }) => {
  return isAuthenticated ? children : <Navigate to="/auth" replace />;
};

// Public Route Component (redirect if already authenticated)
const PublicRoute = ({ children, isAuthenticated }) => {
  return !isAuthenticated ? children : <Navigate to="/" replace />;
};

// Main App component - this is the entry point that gets imported in index.jsx
function App() {
  return (
    <div className="App">
      <Router>
        {/* AuthApp contains the AuthProvider and handles all authentication logic */}
        <AuthApp />
      </Router>
    </div>
  );
}

export default App;