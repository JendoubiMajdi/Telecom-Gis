import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import styles from './Navbar.module.css';
import telcotecLogo from '../assets/telcoteclogo.png';

const Navbar: React.FC = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { toggleTheme, isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadProfilePicture = () => {
    if (!user) {
      console.log(' No user found for profile picture');
      setProfilePicture(null);
      return null;
    }
    
    const pictureKey = `profile_picture_${user.id}`;
    const picture = localStorage.getItem(pictureKey);
    
    console.log(' Loading profile picture:', {
      userId: user.id,
      pictureKey,
      found: !!picture,
      pictureLength: picture?.substring(0, 50) + '...'
    });
    
    setProfilePicture(picture);
    return picture;
  };

  useEffect(() => {
    console.log('👤 User changed in Navbar:', user?.email);
    loadProfilePicture();
  }, [user]);

  useEffect(() => {
    const handleStorageChange = () => {
      console.log(' Storage changed, reloading profile picture');
      loadProfilePicture();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProfileClick = () => {
    navigate('/profile');
    setIsDropdownOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsDropdownOpen(false);
  };

  const handleThemeToggle = () => {
    toggleTheme();
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  if (authLoading) {
    return (
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <Link to="/dashboard" className={styles.logo}>
            <img 
              src={telcotecLogo} 
              alt="Telcotec Logo" 
              className={styles.logoImage}
            />
          </Link>
        </div>
        <div className={styles.navRight}>
          <div className={styles.loadingText}>Loading...</div>
        </div>
      </nav>
    );
  }

  return (
    <nav className={styles.navbar}>
      <div className={styles.navLeft}>
        <Link to="/dashboard" className={styles.logo}>
          <img 
            src={telcotecLogo} 
            alt="Telcotec Logo" 
            className={styles.logoImage}
          />
        </Link>
        
        {user && (
          <div className={styles.navLinks}>
            <Link to="/dashboard" className={styles.navLink}>
              Dashboard
            </Link>
            <Link to="/profile" className={styles.navLink}>
              Profile
            </Link>
          </div>
        )}
      </div>

      <div className={styles.navRight}>
        {user ? (
          <div className={styles.userMenu} ref={dropdownRef}>
            {/* Theme toggle button outside dropdown */}
            <button 
              onClick={handleThemeToggle}
              className={styles.themeToggleButton}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className={styles.themeIcon}>
                {isDarkMode ? '☀️' : '🌙'}
              </span>
            </button>

            <button 
              className={styles.userButton}
              onClick={toggleDropdown}
              aria-label="User menu"
            >
              {profilePicture ? (
                <img 
                  src={profilePicture} 
                  alt="Profile" 
                  className={styles.profilePicture}
                  onError={() => {
                    console.log(' Profile picture failed to load');
                    setProfilePicture(null);
                  }}
                />
              ) : (
                <div className={styles.profileInitial}>
                  {user.fullName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
              )}
              <span className={styles.userName}>
                {user.fullName?.split(' ')[0] || user.email?.split('@')[0]}
              </span>
              <span className={`${styles.dropdownArrow} ${isDropdownOpen ? styles.arrowUp : styles.arrowDown}`}>
                ▼
              </span>
            </button>

            {isDropdownOpen && (
              <div className={styles.dropdownMenu}>
                <div className={styles.dropdownHeader}>
                  {profilePicture ? (
                    <img 
                      src={profilePicture} 
                      alt="Profile" 
                      className={styles.dropdownProfilePicture}
                      onError={() => setProfilePicture(null)}
                    />
                  ) : (
                    <div className={styles.dropdownProfileInitial}>
                      {user.fullName?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className={styles.dropdownUserInfo}>
                    <div className={styles.dropdownUserName}>{user.fullName}</div>
                    <div className={styles.dropdownUserEmail}>{user.email}</div>
                    <div className={styles.dropdownUserRole}>
                      Role: <span className={styles.roleText}>{user.role}</span>
                    </div>
                  </div>
                </div>

                <div className={styles.dropdownDivider}></div>

                <button 
                  onClick={handleProfileClick}
                  className={styles.dropdownItem}
                >
                  <span className={styles.dropdownIcon}>👤</span>
                  My Profile
                </button>

                {/* Theme toggle in dropdown */}
                <button 
                  onClick={handleThemeToggle}
                  className={styles.themeToggleItem}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className={styles.dropdownIcon}>
                      {isDarkMode ? '☀️' : '🌙'}
                    </span>
                    {isDarkMode ? 'Light Mode' : 'Dark Mode'}
                  </div>
                  <div className={styles.themeSwitch}></div>
                </button>

                <div className={styles.dropdownDivider}></div>

                <button 
                  onClick={handleLogout}
                  className={`${styles.dropdownItem} ${styles.logoutItem}`}
                >
                  <span className={styles.dropdownIcon}>🚪</span>
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button 
              onClick={handleThemeToggle}
              className={styles.themeToggleButton}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <span className={styles.themeIcon}>
                {isDarkMode ? '☀️' : '🌙'}
              </span>
            </button>
            <Link to="/login" className={styles.loginButton}>
              Login
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;