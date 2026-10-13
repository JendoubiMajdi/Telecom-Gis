import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './TwoFASettings.module.css';
import FieldError from './FieldError';
import { revealField, shake } from '../utils/validation';

const TwoFASettings: React.FC = () => {
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(false);
  const [showOTPModal, setShowOTPModal] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [otp, setOtp] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [otpFieldError, setOtpFieldError] = useState<string>('');
  const [passwordFieldError, setPasswordFieldError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(60);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const { 
    user, 
    check2FAStatus, 
    sendOtp, 
    verifyOtp, 
    toggle2FA, 
    has2FAEnabled,
    updateUserState 
  } = useAuth();

  // Load current 2FA status
  useEffect(() => {
    load2FAStatus();
  }, []);

  const load2FAStatus = async () => {
    try {
      const status = await check2FAStatus();
      setIs2FAEnabled(status.data.twoFactorEnabled);
    } catch (error) {
      console.error('Failed to load 2FA status:', error);
    }
  };

  // Enable 2FA flow
  const handleEnable2FA = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await sendOtp(user?.email || '', '2fa-enable');
      setShowOTPModal(true);
      startTimer();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP and enable 2FA
  const handleVerifyOTP = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (otp.length !== 6) {
      setOtpFieldError(
        otp.length === 0
          ? 'Enter the 6-digit code sent to your email'
          : `The code must have 6 digits (${otp.length}/6 typed)`
      );
      revealField(document.getElementById('twofa-otp'));
      return;
    }

    setLoading(true);
    setOtpFieldError('');

    try {
      const response = await verifyOtp(user?.email || '', otp, '2fa-enable');
      
      if (response.success) {
        // Call toggle2FA endpoint
        await toggle2FA(true, '');
        setIs2FAEnabled(true);
        updateUserState({ twoFactorEnabled: true });
        setSuccess('2FA enabled successfully!');
        setShowOTPModal(false);
        setOtp('');
      } else {
        setOtpFieldError('This code is not valid. Check your email and try again.');
        shake(document.getElementById('twofa-otp'));
      }
    } catch (err: any) {
      setOtpFieldError(err.response?.data?.message || 'This code is not valid. Check your email and try again.');
      shake(document.getElementById('twofa-otp'));
    } finally {
      setLoading(false);
    }
  };

  // Disable 2FA flow
  const handleDisable2FA = () => {
    setShowPasswordModal(true);
  };

  const handleConfirmDisable = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    if (!password) {
      setPasswordFieldError('Enter your password to confirm');
      revealField(document.getElementById('twofa-password'));
      return;
    }

    setLoading(true);
    setPasswordFieldError('');

    try {
      await toggle2FA(false, password);
      setIs2FAEnabled(false);
      updateUserState({ twoFactorEnabled: false });
      setSuccess('2FA disabled successfully!');
      setShowPasswordModal(false);
      setPassword('');
    } catch (err: any) {
      setPasswordFieldError(err.response?.data?.message || 'Failed to disable 2FA');
      revealField(document.getElementById('twofa-password'));
    } finally {
      setLoading(false);
    }
  };

  const startTimer = () => {
    setTimer(60);
    setResendCooldown(60);
    
    const timerInterval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) clearInterval(timerInterval);
        return prev - 1;
      });
    }, 1000);

    const cooldownInterval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) clearInterval(cooldownInterval);
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    
    try {
      await sendOtp(user?.email || '', '2fa-enable');
      startTimer();
      setError('');
    } catch (err: any) {
      setError('Failed to resend OTP');
    }
  };

  // OTP Modal
  const renderOTPModal = () => (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>Enable Two-Factor Authentication</h3>
        <p className={styles.modalText}>
          Enter the 6-digit code sent to <strong>{user?.email}</strong>
        </p>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        <form onSubmit={handleVerifyOTP} noValidate>
          <div className={styles.otpContainer}>
            <input
              id="twofa-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/[^0-9]/g, ''));
                setOtpFieldError('');
              }}
              placeholder="Enter 6-digit code"
              className={`${styles.otpInput} ${otpFieldError ? 'field-invalid' : ''}`}
              aria-invalid={!!otpFieldError}
              aria-describedby={otpFieldError ? 'twofa-otp-error' : undefined}
              disabled={loading}
              autoFocus
            />
            <FieldError id="twofa-otp-error" message={otpFieldError} />
          </div>

          <div className={styles.timer}>
            {timer > 0 ? (
              <span>Code expires in: <strong>{timer}s</strong></span>
            ) : (
              <span className={styles.expired}>Code expired</span>
            )}
          </div>

          <div className={styles.modalActions}>
            <button
              type="submit"
              disabled={loading}
              className={styles.verifyButton}
            >
              {loading ? 'Verifying...' : 'Verify & Enable'}
            </button>

            <button
              type="button"
              onClick={handleResendOTP}
              disabled={loading || resendCooldown > 0}
              className={styles.resendButton}
            >
              Resend OTP {resendCooldown > 0 ? `(${resendCooldown}s)` : ''}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowOTPModal(false);
                setOtp('');
                setError('');
                setOtpFieldError('');
              }}
              className={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // Password Modal (for disabling 2FA)
  const renderPasswordModal = () => (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <h3 className={styles.modalTitle}>Disable Two-Factor Authentication</h3>
        <p className={styles.modalText}>
          Please enter your password to confirm.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleConfirmDisable} noValidate>
          <input
            id="twofa-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordFieldError('');
            }}
            placeholder="Enter your password"
            className={`${styles.passwordInput} ${passwordFieldError ? 'field-invalid' : ''}`}
            aria-invalid={!!passwordFieldError}
            aria-describedby={passwordFieldError ? 'twofa-password-error' : undefined}
            disabled={loading}
            autoFocus
          />
          <FieldError id="twofa-password-error" message={passwordFieldError} />

          <div className={styles.modalActions}>
            <button
              type="submit"
              disabled={loading}
              className={styles.disableButton}
            >
              {loading ? 'Disabling...' : 'Disable 2FA'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(false);
                setPassword('');
                setError('');
                setPasswordFieldError('');
              }}
              className={styles.cancelButton}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Two-Factor Authentication (2FA)</h3>
        <p className={styles.description}>
          Add an extra layer of security to your account.
        </p>
      </div>

      <div className={styles.statusCard}>
        <div className={styles.statusInfo}>
          <span className={styles.statusIcon}>
            {is2FAEnabled ? '🔒' : '🔓'}
          </span>
          <div className={styles.statusText}>
            <strong>Status:</strong>{' '}
            <span className={is2FAEnabled ? styles.enabled : styles.disabled}>
              {is2FAEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        <div className={styles.action}>
          {!is2FAEnabled ? (
            <button
              onClick={handleEnable2FA}
              disabled={loading}
              className={styles.enableButton}
            >
              {loading ? 'Processing...' : 'Enable 2FA'}
            </button>
          ) : (
            <button
              onClick={handleDisable2FA}
              disabled={loading}
              className={styles.disableButton}
            >
              {loading ? 'Processing...' : 'Disable 2FA'}
            </button>
          )}
        </div>
      </div>

      {showOTPModal && renderOTPModal()}
      {showPasswordModal && renderPasswordModal()}
    </div>
  );
};

export default TwoFASettings;