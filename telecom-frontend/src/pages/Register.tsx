import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Register.module.css';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    role: 'viewer' as 'admin' | 'operator' | 'viewer'
  });
  
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [profilePictureFile, setProfilePictureFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await register(
        formData.email,
        formData.password,
        formData.fullName,
        formData.role
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
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.title}>Telecom GIS Platform</h2>
        <h3 className={styles.subtitle}>Create Account</h3>
        
        {error && (
          <div className={styles.errorAlert}>
            {error}
          </div>
        )}

        {success && (
          <div className={styles.successAlert}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
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
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="fullName" className={styles.label}>Full Name *</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className={styles.input}
              placeholder="Enter your full name"
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={styles.input}
              placeholder="Enter your email"
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={styles.input}
              placeholder="Enter password (min. 6 characters)"
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>Confirm Password *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={styles.input}
              placeholder="Confirm your password"
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="role" className={styles.label}>Role</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={styles.select}
              disabled={loading}
            >
              <option value="viewer">Viewer (Read-only access)</option>
              <option value="operator">Operator (Can edit telecom data)</option>
              <option value="admin">Administrator (Full access)</option>
            </select>
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
          <p className={styles.roleTitle}>Role Information:</p>
          <p className={styles.roleText}>• Viewer: Can view maps and data</p>
          <p className={styles.roleText}>• Operator: Can edit telecom infrastructure</p>
          <p className={styles.roleText}>• Admin: Full system control</p>
        </div>
      </div>
    </div>
  );
};

export default Register;