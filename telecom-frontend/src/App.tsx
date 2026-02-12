import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import OTPVerification from './pages/OTPVerification';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Footer from './components/Footer';
import './App.css';

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <div className="App">
            <Routes>
              {/* Public Routes - No Navbar/Footer */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/otp-verification" element={<OTPVerification />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Protected Routes with Navbar & Footer */}
              <Route path="/dashboard" element={
                <PrivateRoute>
                  <div className="layout-container">
                    <Navbar />
                    <main className="main-content">
                      <Dashboard />
                    </main>
                    <Footer />
                  </div>
                </PrivateRoute>
              } />
              
              <Route path="/profile" element={
                <PrivateRoute>
                  <div className="layout-container">
                    <Navbar />
                    <main className="main-content">
                      <Profile />
                    </main>
                    <Footer />
                  </div>
                </PrivateRoute>
              } />
              
              {/* Redirect root to login */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              
              {/* 404 Page */}
              <Route path="*" element={
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  height: '100vh',
                  flexDirection: 'column' 
                }}>
                  <h1 style={{ fontSize: '48px', color: '#2c3e50' }}>404</h1>
                  <p style={{ fontSize: '18px', color: '#7f8c8d' }}>Page not found</p>
                </div>
              } />
            </Routes>
          </div>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;