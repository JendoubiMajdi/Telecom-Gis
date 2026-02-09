import React from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './Dashboard.module.css';

const Dashboard: React.FC = () => {
  const { user, logout, isLoading } = useAuth();

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return styles.roleAdmin;
      case 'operator': return styles.roleOperator;
      case 'viewer': return styles.roleViewer;
      default: return styles.roleViewer;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        Loading dashboard...
      </div>
    );
  }

  if (!user) {
    return (
      <div className={styles.loading}>
        Please log in to access the dashboard
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Telecom GIS Platform</h1>
          <p>Infrastructure Mapping System - Cameroon</p>
        </div>
        <button 
          onClick={logout} 
          className={styles.logoutButton}
        >
          Logout
        </button>
      </header>

      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Welcome Section */}
        <div className={styles.welcomeCard}>
          <h2 className={styles.welcomeTitle}>
            Welcome, {user.fullName}!
            <span className={`${styles.roleBadge} ${getRoleBadgeClass(user.role)}`}>
              {user.role}
            </span>
          </h2>
          <p className={styles.welcomeText}>
            You are now logged into the Telecom Infrastructure Management System.
          </p>
        </div>

        {/* Dashboard Cards */}
        <div className={styles.dashboardGrid}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              📡 Mobile Network Coverage
            </h3>
            <div className={styles.cardContent}>
              <p>View and analyze mobile network coverage across Cameroon.</p>
              <p>Access 2G, 3G, 4G, and 5G tower locations and coverage maps.</p>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              🔗 Fiber Optic Infrastructure
            </h3>
            <div className={styles.cardContent}>
              <p>Explore fiber optic cable routes and connectivity.</p>
              <p>Analyze network capacity and plan new deployments.</p>
            </div>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>
              🏥 Public Infrastructure
            </h3>
            <div className={styles.cardContent}>
              <p>Map hospitals, ministries, schools, and other public buildings.</p>
              <p>Analyze telecom connectivity to critical infrastructure.</p>
            </div>
          </div>
        </div>

        {/* User Information */}
        <div className={styles.userInfo}>
          <h3 className={styles.userInfoTitle}>Your Account Information</h3>
          <div className={styles.userInfoGrid}>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Full Name</div>
              <div className={styles.infoValue}>{user.fullName}</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Email Address</div>
              <div className={styles.infoValue}>{user.email}</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>User Role</div>
              <div className={styles.infoValue}>
                {user.role}
                <span className={`${styles.roleBadge} ${getRoleBadgeClass(user.role)}`}>
                  {user.role}
                </span>
              </div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Account Created</div>
              <div className={styles.infoValue}>
                {formatDate(user.createdAt)}
              </div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>User ID</div>
              <div className={styles.infoValue}>{user.id}</div>
            </div>
            <div className={styles.infoItem}>
              <div className={styles.infoLabel}>Access Level</div>
              <div className={styles.infoValue}>
                {user.role === 'admin' ? 'Full Access' : 
                 user.role === 'operator' ? 'Edit Access' : 'Read Only'}
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className={styles.card} style={{ marginTop: '30px' }}>
          <h3 className={styles.cardTitle}>🚀 Coming Soon</h3>
          <div className={styles.cardContent}>
            <p>Interactive GIS maps, real-time data visualization, 
               infrastructure planning tools, and analytics dashboard.</p>
            <p>Stay tuned for more features!</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;