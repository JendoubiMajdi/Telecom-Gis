import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import TwoFASettings from '../components/TwoFASettings'; 
import styles from './Profile.module.css';
import FieldError from '../components/FieldError';
import { useFormValidation } from '../hooks/useFormValidation';
import { rules, reveal } from '../utils/validation';

interface ProfileForm {
  fullName: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const validateProfile = (f: ProfileForm) => {
  // The password section is optional: it is only checked once the user starts filling it
  const changingPassword = !!(f.currentPassword || f.newPassword || f.confirmPassword);
  return {
    fullName: rules.fullName(f.fullName),
    currentPassword: changingPassword && !f.currentPassword ? 'Enter your current password to set a new one' : '',
    newPassword: !changingPassword
      ? ''
      : !f.newPassword
        ? 'Enter the new password'
        : rules.password(f.newPassword, 'New password') ||
          (f.newPassword === f.currentPassword ? 'The new password must be different from the current one' : ''),
    confirmPassword: changingPassword && f.newPassword ? rules.confirm(f.confirmPassword, f.newPassword) : '',
  };
};

const Profile: React.FC = () => {
  const { user, logout, updateProfile } = useAuth(); 
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<ProfileForm>({
    fullName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  // Stored picture (what is currently saved) vs. what is displayed (may be pending)
  const [savedPicture, setSavedPicture] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const alertRef = useRef<HTMLDivElement>(null);
  const v = useFormValidation(formData, validateProfile);

  // The result banner is at the top of the card, the Save button at the bottom: bring it into view
  useEffect(() => {
    if (message || error) reveal(alertRef.current);
  }, [message, error]);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.fullName || '',
        email: user.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      const stored = localStorage.getItem(`profile_picture_${user.id}`);
      setSavedPicture(stored);
      setProfilePicture(stored);
    }
  }, [user]);

  const pictureChanged = profilePicture !== savedPicture;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoError('');
    if (file && !file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file (JPG, PNG, GIF…)');
      e.target.value = '';
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setPhotoError('Image size should be less than 5MB');
      e.target.value = '';
      return;
    }
    if (file) {
      const reader= new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Only stage the picture; it is persisted when "Save Changes" is clicked
        setProfilePicture(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePicture = () => {
    // Staged removal; applied on "Save Changes"
    setProfilePicture(null);
    setPhotoError('');
  };

  const persistPicture = () => {
    if (!user) return;
    const key = `profile_picture_${user.id}`;
    try {
      if (profilePicture) {
        localStorage.setItem(key, profilePicture);
      } else {
        localStorage.removeItem(key);
      }
      setSavedPicture(profilePicture);
      window.dispatchEvent(new Event('storage')); // refresh Navbar avatar
    } catch {
      throw new Error('Image is too large to store. Please choose a smaller image.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!v.validateAll()) return;

    setIsLoading(true);

    try {
      const updateData: any = {};

      if (formData.fullName.trim() !== user?.fullName) {
        updateData.fullName = formData.fullName.trim();
      }
      
      if (formData.currentPassword && formData.newPassword) {
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      if (Object.keys(updateData).length === 0 && !pictureChanged) {
        setError('No changes to update');
        setIsLoading(false);
        return;
      }

      let response: any = null;
      if (Object.keys(updateData).length > 0) {
        response = await updateProfile(updateData);
      }
      if (pictureChanged) {
        persistPicture();
      }
      
      setMessage('Profile updated successfully!');
      
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      v.reset();

      console.log(' Profile update response:', response);
      
    } catch (err: any) {
      console.error(' Profile update error:', err);
      
      const errorMessage = err.response?.data?.message ||
                          err.message ||
                          'Failed to update profile. Please try again.';
      // A wrong current password belongs to that field: show it there
      if (/current password/i.test(errorMessage) && formData.currentPassword) {
        v.setServerError('currentPassword', errorMessage);
      } else {
        setError(errorMessage);
      }
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
        
        <div ref={alertRef}>
          {message && <div className={styles.successMessage}>{message}</div>}
          {error && <div className={styles.errorMessage} role="alert">{error}</div>}
        </div>
        
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
            <FieldError message={photoError} />
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
        
        <div className={styles.twoFASection}>
          <TwoFASettings />
        </div>
        
        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Personal Information</h3>
            
            <div className={styles.formGroup}>
              <label htmlFor="fullName" className={styles.label}>
                Full Name *
              </label>
              <input
                {...v.field('fullName')}
                type="text"
                value={formData.fullName}
                onChange={handleInputChange}
                className={`${styles.input} ${v.invalid('fullName')}`}
                autoComplete="name"
                required
                disabled={isLoading}
              />
              <FieldError {...v.errorProps('fullName')} />
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
                {...v.field('currentPassword')}
                type="password"
                value={formData.currentPassword}
                onChange={handleInputChange}
                className={`${styles.input} ${v.invalid('currentPassword')}`}
                autoComplete="current-password"
                placeholder="Enter current password"
                disabled={isLoading}
              />
              <FieldError {...v.errorProps('currentPassword')} />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="newPassword" className={styles.label}>
                New Password
              </label>
              <input
                {...v.field('newPassword')}
                type="password"
                value={formData.newPassword}
                onChange={handleInputChange}
                className={`${styles.input} ${v.invalid('newPassword')}`}
                autoComplete="new-password"
                placeholder="Enter new password (min. 6 characters)"
                disabled={isLoading}
              />
              <FieldError {...v.errorProps('newPassword')} />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm New Password
              </label>
              <input
                {...v.field('confirmPassword')}
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`${styles.input} ${v.invalid('confirmPassword')}`}
                autoComplete="new-password"
                placeholder="Confirm new password"
                disabled={isLoading}
              />
              <FieldError {...v.errorProps('confirmPassword')} />
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