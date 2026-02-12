import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './ForgotPassword.module.css';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showResetInfo, setShowResetInfo] = useState<boolean>(false);
  const [resetToken, setResetToken] = useState<string>('');
  const [resetLink, setResetLink] = useState<string>('');
  
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setShowResetInfo(false);
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await forgotPassword(email);
      
      if (response.success) {
        setSuccess(response.message);
        
        // In development, show reset token/link
        if (response.data?.resetToken || response.data?.resetLink) {
          setShowResetInfo(true);
          setResetToken(response.data.resetToken || '');
          setResetLink(response.data.resetLink || '');
        }
        
        // Clear form
        setEmail('');
      } else {
        setError(response.message || 'Failed to send reset instructions');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = () => {
    if (resetToken) {
      navigator.clipboard.writeText(resetToken);
      alert('Reset token copied to clipboard!');
    }
  };

  const handleCopyLink = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink);
      alert('Reset link copied to clipboard!');
    }
  };

  const handleGoToReset = () => {
    if (resetToken) {
      navigate(`/reset-password?token=${resetToken}`);
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Reset Your Password</h2>
          <p className={styles.subtitle}>
            Enter your email address and we'll send you instructions to reset your password.
          </p>
        </div>

        {error && (
          <div className={styles.errorAlert}>
            <span className={styles.alertIcon}>⚠️</span>
            {error}
          </div>
        )}

        {success && !showResetInfo && (
          <div className={styles.successAlert}>
            <span className={styles.alertIcon}>✅</span>
            {success}
          </div>
        )}

        {!success && (
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
                placeholder="you@example.com"
                required
                disabled={loading}
                autoFocus
              />
            </div>

            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className={styles.spinner}></span>
                  Sending Instructions...
                </>
              ) : 'Send Reset Instructions'}
            </button>
          </form>
        )}

        {/* Development Info - Only shown in dev mode */}
        {showResetInfo && (
          <div className={styles.devInfo}>
            <div className={styles.devHeader}>
              <span className={styles.devIcon}>🚀</span>
              <h3 className={styles.devTitle}>Development Mode</h3>
            </div>
            
            <p className={styles.devText}>
              In production, this would be sent via email. For development:
            </p>
            
            <div className={styles.tokenSection}>
              <div className={styles.tokenHeader}>
                <span className={styles.tokenIcon}>🔑</span>
                <h4 className={styles.tokenTitle}>Reset Token</h4>
              </div>
              <div className={styles.tokenBox}>
                <code className={styles.tokenValue}>{resetToken}</code>
                <button 
                  onClick={handleCopyToken}
                  className={styles.copyButton}
                >
                  📋 Copy
                </button>
              </div>
            </div>
            
            <div className={styles.linkSection}>
              <div className={styles.linkHeader}>
                <span className={styles.linkIcon}>🔗</span>
                <h4 className={styles.linkTitle}>Reset Link</h4>
              </div>
              <div className={styles.linkBox}>
                <a 
                  href={resetLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={styles.linkValue}
                >
                  {resetLink}
                </a>
                <button 
                  onClick={handleCopyLink}
                  className={styles.copyButton}
                >
                  📋 Copy
                </button>
              </div>
            </div>
            
            <div className={styles.actionButtons}>
              <button 
                onClick={handleGoToReset}
                className={styles.resetButton}
              >
                🚀 Go to Reset Password
              </button>
              <button 
                onClick={handleGoToLogin}
                className={styles.loginButton}
              >
                ↩ Back to Login
              </button>
            </div>
          </div>
        )}

        {!showResetInfo && (
          <div className={styles.footer}>
            <div className={styles.links}>
              <span className={styles.linkText}>Remember your password?</span>
              <Link to="/login" className={styles.link}>
                Back to Login
              </Link>
            </div>
            
            <div className={styles.helpSection}>
              <h4 className={styles.helpTitle}>💡 Need help?</h4>
              <ul className={styles.helpList}>
                <li className={styles.helpItem}>
                  Check your spam or junk folder
                </li>
                <li className={styles.helpItem}>
                  Ensure you entered the correct email
                </li>
                <li className={styles.helpItem}>
                  Reset links expire after 15 minutes
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;