import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './TwoFASettings.module.css';

const TwoFASettings: React.FC = () => {
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(false);
  const [showOTPModal, setShowOTPModal] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [otp, setOtp] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
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
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

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
        setError('Invalid OTP');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  // Disable 2FA flow
  const handleDisable2FA = () => {
    setShowPasswordModal(true);
  };

  const handleConfirmDisable = async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await toggle2FA(false, password);
      setIs2FAEnabled(false);
      updateUserState({ twoFactorEnabled: false });
      setSuccess('2FA disabled successfully!');
      setShowPasswordModal(false);
      setPassword('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to disable 2FA');
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

        <div className={styles.otpContainer}>
          <input
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Enter 6-digit code"
            className={styles.otpInput}
            disabled={loading}
            autoFocus
          />
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
            onClick={handleVerifyOTP}
            disabled={loading || otp.length !== 6}
            className={styles.verifyButton}
          >
            {loading ? 'Verifying...' : 'Verify & Enable'}
          </button>
          
          <button
            onClick={handleResendOTP}
            disabled={loading || resendCooldown > 0}
            className={styles.resendButton}
          >
            Resend OTP {resendCooldown > 0 ? `(${resendCooldown}s)` : ''}
          </button>

          <button
            onClick={() => {
              setShowOTPModal(false);
              setOtp('');
              setError('');
            }}
            className={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
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

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className={styles.passwordInput}
          disabled={loading}
          autoFocus
        />

        <div className={styles.modalActions}>
          <button
            onClick={handleConfirmDisable}
            disabled={loading || !password}
            className={styles.disableButton}
          >
            {loading ? 'Disabling...' : 'Disable 2FA'}
          </button>

          <button
            onClick={() => {
              setShowPasswordModal(false);
              setPassword('');
              setError('');
            }}
            className={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
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