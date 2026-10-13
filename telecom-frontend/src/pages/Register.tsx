import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Register.module.css';
import FieldError from '../components/FieldError';
import { useFormValidation } from '../hooks/useFormValidation';
import { rules, reveal } from '../utils/validation';

interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
}

const validateRegister = (f: RegisterForm) => ({
  fullName: rules.fullName(f.fullName),
  email: rules.email(f.email),
  password: rules.password(f.password),
  confirmPassword: rules.confirm(f.confirmPassword, f.password),
});

const Register: React.FC = () => {
  const [formData, setFormData] = useState<RegisterForm>({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: ''
  });
  
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [photoError, setPhotoError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const v = useFormValidation(formData, validateRegister);

  // Server errors are shown at the top of the card: bring them into view
  useEffect(() => {
    if (error || success) reveal(alertRef.current);
  }, [error, success]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');

    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file (JPG, PNG, GIF…)');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image size should be less than 5MB');
      e.target.value = '';
      return;
    }

    setProfilePictureFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicture(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePicture = () => {
    setProfilePicture(null);
    setProfilePictureFile(null);
    setPhotoError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!v.validateAll()) return;

    setLoading(true);

    try {
      await register(
        formData.email.trim(),
        formData.password,
        formData.fullName.trim()
      );

      if (profilePicture) {
        setTimeout(() => {
          const userStr = localStorage.getItem('user');
          const token = localStorage.getItem('token');
          
          if (userStr && token) {
            try {
              const user = JSON.parse(userStr);
              localStorage.setItem(`profile_picture_${user.id}`, profilePicture);
              console.log(' Profile picture saved for user ID:', user.id);
              
              window.dispatchEvent(new Event('storage'));
            } catch (err) {
              console.error(' Error saving profile picture:', err);
            }
          } else {
            console.error(' User or token not found in localStorage');
          }
        }, 100);
      }

      setSuccess('Registration successful! Redirecting to dashboard...');
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
      
    } catch (err: any) {
      // the API answers with { message } (and sometimes { error })
      const apiMessage: string = err.response?.data?.message || err.response?.data?.error || '';
      if (err.response?.status === 409 || /already exists/i.test(apiMessage)) {
        // shown under the Email field, which is where the user has to fix it
        v.setServerError('email', 'An account with this email already exists. Use another email or log in instead.');
      } else if (!err.response) {
        setError('Cannot reach the server. Check your connection and try again.');
      } else {
        setError(apiMessage || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Telecom GIS Platform</h2>
        <h3 className={styles.subtitle}>Create Account</h3>
        
        <div ref={alertRef}>
          {error && (
            <div className={styles.errorAlert} role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className={styles.successAlert}>
              {success}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.profilePictureSection}>
            <div className={styles.profilePictureContainer}>
              {profilePicture ? (
                <img 
                  src={profilePicture} 
                  alt="Profile preview" 
                  className={styles.profilePicturePreview}
                />
              ) : (
                <div className={styles.profilePlaceholder}>
                  <span className={styles.placeholderIcon}>👤</span>
                  <span className={styles.placeholderText}>Add Photo</span>
                </div>
              )}
            </div>
            
            <div className={styles.pictureControls}>
              <label className={styles.uploadButton}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className={styles.fileInput}
                  disabled={loading}
                />
                Choose Photo
              </label>
              
              {profilePicture && (
                <button 
                  type="button" 
                  onClick={handleRemovePicture}
                  className={styles.removeButton}
                  disabled={loading}
                >
                  Remove
                </button>
              )}
            </div>
            
            <p className={styles.pictureHint}>
              Optional: Square image, max 5MB
            </p>
            <FieldError message={photoError} />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="fullName" className={styles.label}>Full Name *</label>
            <input
              type="text"
              {...v.field('fullName')}
              value={formData.fullName}
              onChange={handleChange}
              className={`${styles.input} ${v.invalid('fullName')}`}
              autoComplete="name"
              placeholder="Enter your full name"
              required
              disabled={loading}
            />
            <FieldError {...v.errorProps('fullName')} />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>Email *</label>
            <input
              type="email"
              {...v.field('email')}
              value={formData.email}
              onChange={handleChange}
              className={`${styles.input} ${v.invalid('email')}`}
              autoComplete="email"
              placeholder="Enter your email"
              required
              disabled={loading}
            />
            <FieldError {...v.errorProps('email')} />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>Password *</label>
            <input
              type="password"
              {...v.field('password')}
              value={formData.password}
              onChange={handleChange}
              className={`${styles.input} ${v.invalid('password')}`}
              autoComplete="new-password"
              placeholder="Enter password (min. 6 characters)"
              required
              disabled={loading}
            />
            <FieldError {...v.errorProps('password')} />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>Confirm Password *</label>
            <input
              type="password"
              {...v.field('confirmPassword')}
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`${styles.input} ${v.invalid('confirmPassword')}`}
              autoComplete="new-password"
              placeholder="Confirm your password"
              required
              disabled={loading}
            />
            <FieldError {...v.errorProps('confirmPassword')} />
          </div>

          <button
            type="submit" 
            className={styles.button}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <div className={styles.links}>
          <span className={styles.linkText}>Already have an account? </span>
          <Link to="/login" className={styles.link}>Login here</Link>
        </div>

        <div className={styles.roleInfo}>
          <p className={styles.roleTitle}>About your access:</p>
          <p className={styles.roleText}>New accounts start as Viewer (can view maps and data).</p>
          <p className={styles.roleText}>An administrator can upgrade you to Operator or Admin.</p>
        </div>
      </div>
    </div>
  );
};

export default Register;