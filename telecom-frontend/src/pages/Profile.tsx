import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import styles from './Profile.module.css';

const Profile: React.FC = () => {
  const { user, logout, updateProfile } = useAuth(); 
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      const savedPicture = localStorage.getItem(`profile_picture_${user.id}`);
      if (savedPicture) {
        setProfilePicture(savedPicture);
      }
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setProfilePicture(result);
        
        if (user) {
          localStorage.setItem(`profile_picture_${user.id}`, result);
          
          window.dispatchEvent(new Event('storage'));
          
          console.log('📸 Profile picture updated and event triggered');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePicture = () => {
    setProfilePicture(null);
    if (user) {
      localStorage.removeItem(`profile_picture_${user.id}`);
      
      window.dispatchEvent(new Event('storage'));
      
      console.log('🗑️ Profile picture removed and event triggered');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsLoading(true);

    if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.newPassword && !formData.currentPassword) {
      setError('Current password is required to set a new password');
      setIsLoading(false);
      return;
    }

    if (formData.newPassword && formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    try {
      const updateData: any = {};
      
      if (formData.fullName !== user?.fullName) {
        updateData.fullName = formData.fullName;
      }
      
      if (formData.currentPassword && formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      if (Object.keys(updateData).length === 0) {
        setError('No changes to update');
        setIsLoading(false);
        return;
      }

      console.log(' Sending update data:', updateData);
      
      const response = await updateProfile(updateData);
      
      setMessage('Profile updated successfully!');
      
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      
      console.log(' Profile update response:', response);
      
    } catch (err: any) {
      console.error(' Profile update error:', err);
      
      const errorMessage = err.response?.data?.message || 
                          err.message || 
                          'Failed to update profile. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.profileCard}>
        <h1 className={styles.title}>My Profile</h1>
        
        {message && <div className={styles.successMessage}>{message}</div>}
        {error && <div className={styles.errorMessage}>{error}</div>}
        
        <div className={styles.profileHeader}>
          <div className={styles.profilePictureSection}>
            <div className={styles.profilePictureContainer}>
              {profilePicture ? (
                <img 
                  src={profilePicture} 
                  alt="Profile" 
                  className={styles.profilePicture}
                />
              ) : (
                <div className={styles.profilePlaceholder}>
                  {user.fullName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
              )}
            </div>
            
            <div className={styles.pictureControls}>
              <label className={styles.uploadButton}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className={styles.fileInput}
                  disabled={isLoading}
                />
                Change Photo
              </label>
              
              {profilePicture && (
                <button 
                  type="button" 
                  onClick={handleRemovePicture}
                  className={styles.removeButton}
                  disabled={isLoading}
                >
                  Remove
                </button>
              )}
            </div>
            
            <p className={styles.pictureHint}>
              Recommended: Square image, at least 200x200 pixels
            </p>
          </div>
          
          <div className={styles.userInfoSummary}>
            <h2 className={styles.userName}>{user.fullName}</h2>
            <p className={styles.userEmail}>{user.email}</p>
            <div className={styles.roleBadge}>
              Role: <span className={styles.roleValue}>{user.role}</span>
            </div>
            <p className={styles.memberSince}>
              Member since: {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Personal Information</h3>
            
            <div className={styles.formGroup}>
              <label htmlFor="fullName" className={styles.label}>
                Full Name *
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleInputChange}
                className={styles.input}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                className={styles.input}
                disabled
                readOnly
              />
              <p className={styles.hint}>
                Email cannot be changed. Contact administrator for email changes.
              </p>
            </div>
          </div>
          
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Change Password</h3>
            <p className={styles.sectionDescription}>
              Leave blank if you don't want to change your password
            </p>
            
            <div className={styles.formGroup}>
              <label htmlFor="currentPassword" className={styles.label}>
                Current Password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="Enter current password"
                disabled={isLoading}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="newPassword" className={styles.label}>
                New Password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="Enter new password (min. 6 characters)"
                disabled={isLoading}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={styles.input}
                placeholder="Confirm new password"
                disabled={isLoading}
              />
            </div>
          </div>
          
          <div className={styles.formActions}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className={styles.cancelButton}
              disabled={isLoading}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className={styles.saveButton}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;