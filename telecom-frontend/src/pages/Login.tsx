import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';
import logo from '../assets/telcoteclogo.png';
import FieldError from '../components/FieldError';
import { useFormValidation } from '../hooks/useFormValidation';
import { rules } from '../utils/validation';

const validateLogin = (f: { email: string; password: string }) => ({
  email: rules.email(f.email),
  password: f.password ? '' : 'Password is required',
});

const Login: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const { login, isAuthenticated, sendOtp, setVerifyingOTP } = useAuth();
  const navigate = useNavigate();

  const v = useFormValidation({ email, password }, validateLogin);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  if (!v.validateAll()) return;
  setLoading(true);

  try {
    const loginResult = await login(email.trim(), password);
    
    if (loginResult.requiresOtp) {
      try {
        setVerifyingOTP(true);
        await sendOtp(email.trim(), 'login');
        navigate('/otp-verification', { state: { email: email.trim() } });
        return;
      } catch (otpError: any) {
        console.error('❌ Failed to send OTP:', otpError);
        setVerifyingOTP(false);
        setError('Failed to send verification code. Please try again.');
      }
    } else {
      // No 2FA, user is authenticated
      navigate('/dashboard');
    }
    
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
          <div className={styles.logoContainer}>
            <img src={logo} alt="Telcotec logo" className={styles.logo} />
          </div>
          <div className={styles.titleGroup}>
            <h2 className={styles.title}>Telecom GIS Platform</h2>
            <h3 className={styles.subtitle}>Secure Login</h3>
          </div>
        </div>
        
        {error && (
          <div className={styles.errorAlert}>
            <span className={styles.alertIcon}>⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              <span className={styles.labelIcon}>📧</span>
              Email Address
            </label>
            <input
              type="email"
              {...v.field('email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${styles.input} ${v.invalid('email')}`}
              placeholder="Enter your email"
              autoComplete="email"
              required
              disabled={loading}
              autoFocus
            />
            <FieldError {...v.errorProps('email')} />
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
                {...v.field('password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${styles.input} ${v.invalid('password')}`}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>
            <FieldError {...v.errorProps('password')} />
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
            disabled={loading}
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
        </form>

        <div className={styles.footer}>
          <div className={styles.links}>
            <span className={styles.linkText}>Don't have an account? </span>
            <Link to="/register" className={styles.link}>Register here</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;