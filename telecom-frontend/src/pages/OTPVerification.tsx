import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './OTPVerification.module.css';
import FieldError from '../components/FieldError';
import { revealField, shake } from '../utils/validation';

const OTP_LENGTH = 6;
const EMPTY_OTP: string[] = Array(OTP_LENGTH).fill('');

const OTPVerification: React.FC = () => {
  // one entry per box, so an empty box in the middle stays empty
  const [digits, setDigits] = useState<string[]>(EMPTY_OTP);
  const [otpError, setOtpError] = useState<string>('');
  const otpBoxesRef = useRef<HTMLDivElement>(null);
  const otp = digits.join('');
  const [email, setEmail] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [timer, setTimer] = useState<number>(60);

  const { verifyOtp, sendOtp, setVerifyingOTP } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Set verification flag when component mounts
  useEffect(() => {
    setVerifyingOTP(true);
    
    return () => {
      // Only clear flag if navigating away without success
      if (window.location.pathname !== '/dashboard') {
        setVerifyingOTP(false);
      }
    };
  }, [setVerifyingOTP]);

  // Get email from location state or localStorage
  useEffect(() => {
    const stateEmail = (location.state as any)?.email;
    const storedUser = localStorage.getItem('user');
    
    if (stateEmail) {
      setEmail(stateEmail);
    } else if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setEmail(user.email);
      } catch (err) {
        console.error('Error parsing stored user:', err);
      }
    }
  }, [location]);

  // Timer countdown effect
  useEffect(() => {
    let countdown: NodeJS.Timeout;
    
    if (timer > 0) {
      countdown = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            clearInterval(countdown);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdown) clearInterval(countdown);
    };
  }, [timer]);

  const focusBox = (index: number) => document.getElementById(`otp-${index}`)?.focus();

  const clearOtp = () => {
    setDigits(EMPTY_OTP);
    focusBox(0);
  };

  // Handle OTP input changes (auto-advance)
  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value;

    // Allow only numbers
    if (!/^\d*$/.test(value)) {
      setOtpError('The code contains digits only');
      shake(e.target);
      return;
    }

    setOtpError('');
    setDigits(prev => prev.map((d, i) => (i === index ? value.slice(-1) : d)));

    // Auto-focus next input
    if (value && index < OTP_LENGTH - 1) focusBox(index + 1);
  };

  // Backspace on an empty box goes back; arrows move between boxes
  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      e.preventDefault();
      setDigits(prev => prev.map((d, i) => (i === index - 1 ? '' : d)));
      focusBox(index - 1);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      focusBox(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      e.preventDefault();
      focusBox(index + 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    const firstEmpty = digits.findIndex(d => !d);
    if (firstEmpty !== -1) {
      const missing = digits.filter(d => !d).length;
      setOtpError(
        missing === OTP_LENGTH
          ? 'Enter the 6-digit code we sent to your email'
          : `The code is incomplete: ${missing} digit${missing > 1 ? 's' : ''} missing`
      );
      revealField(document.getElementById(`otp-${firstEmpty}`));
      shake(otpBoxesRef.current);
      return;
    }
    
    if (!email) {
      setError('Email not found. Please login again.');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await verifyOtp(email, otp, 'login');
      
      if (response.success) {
        // Clear verification flag on success
        setVerifyingOTP(false);
        setSuccess('OTP verified successfully! Redirecting...');
        
        // Clear OTP from state
        setDigits(EMPTY_OTP);
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } else {
        setError(response.message || 'Invalid OTP');
        setOtpError('This code is not valid. Please type it again.');
        shake(otpBoxesRef.current);
        clearOtp();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to verify OTP');
      setOtpError('This code is not valid. Please type it again.');
      shake(otpBoxesRef.current);
      clearOtp();
    }finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    if (!email) {
      setError('Email not found. Please login again.');
      setTimeout(() => navigate('/login'), 2000);
      return;
    }
    
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      const response = await sendOtp(email, 'login');
      
      if (response.success) {
        // Keep verification flag active
        setVerifyingOTP(true);
        setSuccess('New OTP sent to your email');
        setResendCooldown(60);
        setTimer(60);
        setOtpError('');
        clearOtp();

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
    // Clear verification flag when going back to login
    setVerifyingOTP(false);
    navigate('/login');
  };

  // Handle paste event for OTP
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const numbers = pastedData.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);

    if (numbers.length > 0) {
      setOtpError('');
      setDigits(EMPTY_OTP.map((_, i) => numbers[i] ?? ''));
      // Focus the next empty box, or the last one when the code is complete
      focusBox(Math.min(numbers.length, OTP_LENGTH - 1));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>Two-Factor Authentication</h2>
          <p className={styles.subtitle}>
            Enter the 6-digit verification code sent to<br />
            <span className={styles.email}>{email || 'your email'}</span>
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

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.otpContainer} onPaste={handlePaste} ref={otpBoxesRef}>
            {digits.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(e, index)}
                onKeyDown={(e) => handleOtpKeyDown(e, index)}
                onFocus={(e) => e.target.select()}
                className={`${styles.otpInput} ${otpError && !digit ? 'field-invalid' : ''}`}
                aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
                aria-invalid={!!otpError && !digit}
                aria-describedby={otpError ? 'otp-error' : undefined}
                disabled={loading}
                autoFocus={index === 0}
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
              />
            ))}
          </div>
          <div className={styles.otpErrorRow}>
            <FieldError id="otp-error" message={otpError} />
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
              disabled={loading}
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