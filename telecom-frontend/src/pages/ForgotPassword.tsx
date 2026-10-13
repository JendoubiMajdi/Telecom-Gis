import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './ForgotPassword.module.css';
import FieldError from '../components/FieldError';
import { useFormValidation } from '../hooks/useFormValidation';
import { rules } from '../utils/validation';

const validateForgot = (f: { email: string }) => ({ email: rules.email(f.email) });

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const v = useFormValidation({ email }, validateForgot);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!v.validateAll()) return;

    setLoading(true);
    
    try {
      const response = await forgotPassword(email.trim());
      
      if (response.success) {
        setSuccess(response.message);
        // Clear form
        setEmail('');
        v.reset();
      } else {
        setError(response.message || 'Failed to send reset instructions');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
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

        {success && (
          <div className={styles.successAlert}>
            <span className={styles.alertIcon}>✅</span>
            {success}
          </div>
        )}

        {!success && (
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
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={loading}
                autoFocus
              />
              <FieldError {...v.errorProps('email')} />
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
      </div>
    </div>
  );
};

export default ForgotPassword;