import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  const { login, isAuthenticated, sendOtp, has2FAEnabled } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First, try regular login
      await login(email, password);
      
      // Check if user has 2FA enabled
      const userHas2FA = has2FAEnabled();
      
      if (userHas2FA) {
        // If 2FA is enabled, send OTP and redirect to verification
        try {
          await sendOtp(email, 'login');
          navigate('/otp-verification', { state: { email } });
          return; // Don't navigate to dashboard yet
        } catch (otpError: any) {
          console.error('Failed to send OTP:', otpError);
          // Continue to dashboard even if OTP fails (fallback)
        }
      }
      
      // If no 2FA or OTP failed, go to dashboard
      navigate('/dashboard');
      
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.error || 
                          'Login failed. Please check your credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Telecom GIS Platform</h2>
          <h3 className={styles.subtitle}>Secure Login</h3>
          <div className={styles.securityBadge}>
            <span className={styles.badgeIcon}>🔒</span>
            <span className={styles.badgeText}>Two-Factor Authentication Ready</span>
          </div>
        </div>
        
        {error && (
          <div className={styles.errorAlert}>
            <span className={styles.alertIcon}>⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              <span className={styles.labelIcon}>📧</span>
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="Enter your email"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <div className={styles.passwordHeader}>
              <label htmlFor="password" className={styles.label}>
                <span className={styles.labelIcon}>🔑</span>
                Password
              </label>
              <button
                type="button"
                onClick={toggleShowPassword}
                className={styles.showPasswordButton}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className={styles.passwordContainer}>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="Enter your password"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className={styles.rememberForgot}>
            <button
              type="button"
              onClick={handleForgotPassword}
              className={styles.forgotButton}
              disabled={loading}
            >
              Forgot Password?
            </button>
          </div>

          <button 
            type="submit" 
            className={styles.button}
            disabled={loading || !email || !password}
          >
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>

          <div className={styles.separator}>
            <span className={styles.separatorLine}></span>
            <span className={styles.separatorText}>or</span>
            <span className={styles.separatorLine}></span>
          </div>

          <div className={styles.demoNote}>
            <span className={styles.noteIcon}>💡</span>
            <span className={styles.noteText}>Demo users have 2FA enabled</span>
          </div>
        </form>

        <div className={styles.footer}>
          <div className={styles.links}>
            <span className={styles.linkText}>Don't have an account? </span>
            <Link to="/register" className={styles.link}>Register here</Link>
          </div>

          <div className={styles.securityInfo}>
            <h4 className={styles.securityTitle}>🔒 Security Features:</h4>
            <ul className={styles.securityList}>
              <li className={styles.securityItem}>
                <span className={styles.itemIcon}>✅</span>
                Two-Factor Authentication
              </li>
              <li className={styles.securityItem}>
                <span className={styles.itemIcon}>✅</span>
                Secure Password Encryption
              </li>
              <li className={styles.securityItem}>
                <span className={styles.itemIcon}>✅</span>
                Account Lockout Protection
              </li>
            </ul>
          </div>

<div className={styles.demoCredentials}>
  <h4 className={styles.demoTitle}>Demo Credentials:</h4>
  <div className={styles.demoAccount}>
    <span className={styles.demoLabel}>👑 Admin:</span>
    <span className={styles.demoText}>admin@telecom.cm / Admin123!</span>
  </div>
  <div className={styles.demoAccount}>
    <span className={styles.demoLabel}>👤 User:</span>
    <span className={styles.demoText}>test@telecom.cm / Test123!</span>
  </div>
</div>
        </div>
      </div>
    </div>
  );
};

export default Login;