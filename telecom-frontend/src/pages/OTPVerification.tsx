import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './OTPVerification.module.css';

const OTPVerification: React.FC = () => {
  const [otp, setOtp] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [timer, setTimer] = useState<number>(60);
  
  const { verifyOtp, sendOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Get email from location state or localStorage
  useEffect(() => {
    const stateEmail = (location.state as any)?.email;
    const storedUser = localStorage.getItem('user');
    
    if (stateEmail) {
      setEmail(stateEmail);
    } else if (storedUser) {
      const user = JSON.parse(storedUser);
      setEmail(user.email);
    }
    
    // Start countdown timer
    const countdown = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(countdown);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [location]);

  // Handle OTP input changes (auto-advance)
  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value;
    
    // Allow only numbers
    if (!/^\d*$/.test(value)) return;
    
    // Update OTP string
    const otpArray = otp.split('');
    otpArray[index] = value;
    const newOtp = otpArray.join('').slice(0, 6);
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await verifyOtp(email, otp, 'login');
      
      if (response.success) {
        setSuccess('OTP verified successfully! Redirecting...');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        setError(response.message || 'Invalid OTP');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      const response = await sendOtp(email, 'login');
      
      if (response.success) {
        setSuccess('New OTP sent to your email');
        setResendCooldown(60);
        setTimer(60);
        
        // Start cooldown timer
        const cooldownInterval = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              clearInterval(cooldownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setError(response.message || 'Failed to resend OTP');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Two-Factor Authentication</h2>
          <p className={styles.subtitle}>
            Enter the 6-digit verification code sent to<br />
            <span className={styles.email}>{email}</span>
          </p>
        </div>

        {error && (
          <div className={styles.errorAlert}>
            <span className={styles.errorIcon}>⚠️</span>
            {error}
          </div>
        )}

        {success && (
          <div className={styles.successAlert}>
            <span className={styles.successIcon}>✅</span>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.otpContainer}>
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otp[index] || ''}
                onChange={(e) => handleOtpChange(e, index)}
                className={styles.otpInput}
                disabled={loading}
                autoFocus={index === 0}
              />
            ))}
          </div>

          <div className={styles.timer}>
            {timer > 0 ? (
              <span className={styles.timerText}>
                Code expires in: <span className={styles.timerCount}>{timer}s</span>
              </span>
            ) : (
              <span className={styles.expiredText}>Code expired</span>
            )}
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="submit"
              className={styles.verifyButton}
              disabled={loading || otp.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <button
              type="button"
              className={styles.resendButton}
              onClick={handleResendOtp}
              disabled={loading || resendCooldown > 0}
            >
              {resendCooldown > 0 
                ? `Resend OTP (${resendCooldown}s)` 
                : 'Resend OTP'}
            </button>

            <button
              type="button"
              className={styles.backButton}
              onClick={handleGoBack}
              disabled={loading}
            >
              Back to Login
            </button>
          </div>
        </form>

        <div className={styles.helpSection}>
          <h3 className={styles.helpTitle}>Need help?</h3>
          <ul className={styles.helpList}>
            <li className={styles.helpItem}>
              <span className={styles.helpIcon}>📧</span>
              Check your email (including spam folder)
            </li>
            <li className={styles.helpItem}>
              <span className={styles.helpIcon}>⏱️</span>
              OTP codes expire after 5 minutes
            </li>
            <li className={styles.helpItem}>
              <span className={styles.helpIcon}>🔒</span>
              Never share your OTP with anyone
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default OTPVerification;