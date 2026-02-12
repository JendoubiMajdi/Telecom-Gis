import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './ResetPassword.module.css';

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [token, setToken] = useState<string>('');
  const [tokenValid, setTokenValid] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [passwordStrength, setPasswordStrength] = useState<number>(0);
  
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get token from URL
  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      // In a real app, you would validate the token here
      // For now, we'll assume it's valid if present
      setTokenValid(true);
    } else {
      setTokenValid(false);
      setError('No reset token found in URL');
    }
  }, [searchParams]);

  // Check password strength
  useEffect(() => {
    let strength = 0;
    
    if (newPassword.length >= 8) strength += 1;
    if (/[A-Z]/.test(newPassword)) strength += 1;
    if (/[a-z]/.test(newPassword)) strength += 1;
    if (/[0-9]/.test(newPassword)) strength += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) strength += 1;
    
    setPasswordStrength(strength);
  }, [newPassword]);

  const getPasswordStrengthText = () => {
    if (newPassword.length === 0) return 'Enter a password';
    if (passwordStrength <= 1) return 'Very Weak';
    if (passwordStrength === 2) return 'Weak';
    if (passwordStrength === 3) return 'Fair';
    if (passwordStrength === 4) return 'Good';
    return 'Strong';
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 1) return '#e74c3c'; // Red
    if (passwordStrength === 2) return '#e67e22'; // Orange
    if (passwordStrength === 3) return '#f1c40f'; // Yellow
    if (passwordStrength === 4) return '#2ecc71'; // Green
    return '#27ae60'; // Dark Green
  };

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    
    if (password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Include at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Include at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Include at least one number');
    }
    
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!token || !tokenValid) {
      setError('Invalid reset token. Please request a new password reset.');
      return;
    }
    
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    const passwordErrors = validatePassword(newPassword);
    if (passwordErrors.length > 0) {
      setError(passwordErrors[0]);
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await resetPassword(token, newPassword);
      
      if (response.success) {
        setSuccess('Password reset successfully! Redirecting to login...');
        
        // Clear form
        setNewPassword('');
        setConfirmPassword('');
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(response.message || 'Failed to reset password');
        setTokenValid(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
      setTokenValid(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestNewLink = () => {
    navigate('/forgot-password');
  };

  if (!tokenValid) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>🔒</div>
            <h2 className={styles.errorTitle}>Invalid Reset Link</h2>
            <p className={styles.errorText}>
              This password reset link is invalid or has expired. 
              Please request a new password reset link.
            </p>
            <button 
              onClick={handleRequestNewLink}
              className={styles.requestButton}
            >
              Request New Reset Link
            </button>
            <Link to="/login" className={styles.loginLink}>
              ↩ Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Create New Password</h2>
          <p className={styles.subtitle}>
            Enter a new password for your account. Make sure it's strong and secure.
          </p>
        </div>

        {error && (
          <div className={styles.errorAlert}>
            <span className={styles.alertIcon}>⚠️</span>
            {error}
          </div>
        )}

        {success && (
          <div className={styles.successAlert}>
            <span className={styles.alertIcon}>✅</span>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Password Strength Meter */}
          {newPassword && (
            <div className={styles.strengthMeter}>
              <div className={styles.strengthHeader}>
                <span className={styles.strengthIcon}>🔒</span>
                <span className={styles.strengthText}>
                  Password Strength: <span style={{ color: getPasswordStrengthColor() }}>
                    {getPasswordStrengthText()}
                  </span>
                </span>
              </div>
              <div className={styles.strengthBar}>
                <div 
                  className={styles.strengthFill}
                  style={{ 
                    width: `${(passwordStrength / 5) * 100}%`,
                    backgroundColor: getPasswordStrengthColor()
                  }}
                ></div>
              </div>
              <div className={styles.strengthRequirements}>
                {validatePassword(newPassword).map((req, index) => (
                  <div key={index} className={styles.requirementItem}>
                    <span className={styles.requirementIcon}>
                      {newPassword.length >= 6 && req.includes('characters') ? '✅' : '❌'}
                      {/[A-Z]/.test(newPassword) && req.includes('uppercase') ? '✅' : '❌'}
                      {/[a-z]/.test(newPassword) && req.includes('lowercase') ? '✅' : '❌'}
                      {/[0-9]/.test(newPassword) && req.includes('number') ? '✅' : '❌'}
                    </span>
                    <span className={styles.requirementText}>{req}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Password */}
          <div className={styles.formGroup}>
            <label htmlFor="newPassword" className={styles.label}>
              <span className={styles.labelIcon}>🔑</span>
              New Password
            </label>
            <div className={styles.passwordInputContainer}>
              <input
                type={showPassword ? "text" : "password"}
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={styles.input}
                placeholder="Enter new password"
                required
                disabled={loading}
                autoFocus
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>
              <span className={styles.labelIcon}>🔒</span>
              Confirm Password
            </label>
            <div className={styles.passwordInputContainer}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={styles.input}
                placeholder="Confirm new password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className={styles.togglePassword}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
              >
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={loading || !tokenValid}
          >
            {loading ? (
              <>
                <span className={styles.spinner}></span>
                Resetting Password...
              </>
            ) : 'Reset Password'}
          </button>
        </form>

        <div className={styles.footer}>
          <div className={styles.securityTips}>
            <h4 className={styles.tipsTitle}>💡 Security Tips:</h4>
            <ul className={styles.tipsList}>
              <li className={styles.tipItem}>Use at least 8 characters</li>
              <li className={styles.tipItem}>Mix uppercase and lowercase letters</li>
              <li className={styles.tipItem}>Include numbers and symbols</li>
              <li className={styles.tipItem}>Avoid common words or patterns</li>
            </ul>
          </div>
          
          <div className={styles.links}>
            <Link to="/login" className={styles.link}>
              ↩ Back to Login
            </Link>
            <span className={styles.separator}>•</span>
            <Link to="/forgot-password" className={styles.link}>
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;