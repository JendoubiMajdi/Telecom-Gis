import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import styles from './Footer.module.css';
import telcotecLogo from '../assets/telcoteclogo.png';

const Footer: React.FC = () => {
  const { isDarkMode } = useTheme();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerMain}>
        <div className={styles.footerContainer}>
          {/* Company Info Section */}
          <div className={styles.footerColumn}>
            <div className={styles.brandSection}>
              <img 
                src={telcotecLogo} 
                alt="Telcotec Logo" 
                className={styles.footerLogo}
              />
              <h2 className={styles.companyName}>TELCOTEC</h2>
              <p className={styles.tagline}>Sharing Knowledge...</p>
            </div>
            
            <p className={styles.companyDescription}>
              Leading provider of telecommunications systems, security solutions, 
              and strategic consulting services in Tunisia.
            </p>

            <div className={styles.socialSection}>
              <p className={styles.socialTitle}>Follow Us</p>
              <div className={styles.socialIcons}>
                <a 
                  href="#" 
                  className={styles.socialIcon}
                  aria-label="Facebook"
                  onClick={(e) => e.preventDefault()}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a 
                  href="#" 
                  className={styles.socialIcon}
                  aria-label="LinkedIn"
                  onClick={(e) => e.preventDefault()}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
                <a 
                  href="#" 
                  className={styles.socialIcon}
                  aria-label="Twitter"
                  onClick={(e) => e.preventDefault()}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className={styles.footerColumn}>
            <h3 className={styles.columnTitle}>Quick Links</h3>
            <ul className={styles.linkList}>
              <li><Link to="/company" className={styles.footerLink}>About Us</Link></li>
              <li><Link to="/services" className={styles.footerLink}>Our Services</Link></li>
              <li><Link to="/presentation" className={styles.footerLink}>Presentation</Link></li>
              <li><Link to="/contact" className={styles.footerLink}>Contact Us</Link></li>
              <li><Link to="/careers" className={styles.footerLink}>Careers</Link></li>
            </ul>

            <h3 className={styles.columnTitle} style={{ marginTop: '30px' }}>Our Services</h3>
            <ul className={styles.linkList}>
              <li className={styles.serviceItem}>
                <span className={styles.serviceIcon}>📡</span>
                Telecommunications & Networks
              </li>
              <li className={styles.serviceItem}>
                <span className={styles.serviceIcon}>🔒</span>
                Security & Safety
              </li>
              <li className={styles.serviceItem}>
                <span className={styles.serviceIcon}>💼</span>
                Strategic Consulting
              </li>
              <li className={styles.serviceItem}>
                <span className={styles.serviceIcon}>⚙️</span>
                Solution Development
              </li>
              <li className={styles.serviceItem}>
                <span className={styles.serviceIcon}>🎓</span>
                Training & Knowledge Transfer
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className={styles.footerColumn}>
            <h3 className={styles.columnTitle}>Contact Information</h3>
            
            <div className={styles.contactBlock}>
              <div className={styles.contactItem}>
                <span className={styles.contactIcon}>📍</span>
                <div className={styles.contactText}>
                  <strong>Address</strong>
                  <p>Bloc I2, A14, Elgazala Technopark<br />2083 Ariana, Tunisia</p>
                </div>
              </div>
              
              <div className={styles.contactItem}>
                <span className={styles.contactIcon}>📧</span>
                <div className={styles.contactText}>
                  <strong>Email</strong>
                  <a href="mailto:commercial@telcotech.tn" className={styles.contactLink}>
                    commercial@telcotech.tn
                  </a>
                </div>
              </div>
              
              <div className={styles.contactItem}>
                <span className={styles.contactIcon}>📞</span>
                <div className={styles.contactText}>
                  <strong>Phone</strong>
                  <a href="tel:+21671857498" className={styles.contactLink}>
                    +216 71 857 498
                  </a>
                </div>
              </div>
            </div>

            <div className={styles.rating}>
              <span className={styles.stars}>★★★★★</span>
              <span className={styles.ratingText}>5.0 (2 reviews)</span>
            </div>
          </div>

          {/* Location Map Section */}
          <div className={styles.footerColumn}>
            <h3 className={styles.columnTitle}>Find Us</h3>
            <div className={styles.mapContainer}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3190.640287112148!2d10.187108315288904!3d36.89696997993169!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x12e2cb7454c6c51f%3A0x8b4b8d8f8f8f8f8f!2sElgazala%20Technopark%2C%20Ariana%2C%20Tunisia!5e0!3m2!1sen!2stn!4v1641234567890!5m2!1sen!2stn"
                width="100%"
                height="220"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Telcotech Location Map"
                className={styles.mapIframe}
              />
              
              <div className={styles.mapActions}>
                <button 
                  className={styles.mapButton}
                  onClick={() => window.open('https://maps.google.com/?q=Elgazala+Technopark+Ariana+Tunisia', '_blank')}
                >
                  <span>📍</span>
                  Open in Google Maps
                </button>
              </div>
              
              <div className={styles.nearbyPlaces}>
                <h4 className={styles.nearbyTitle}>Nearby Landmarks</h4>
                <div className={styles.nearbyItem}>
                  <span className={styles.nearbyIcon}>👤</span>
                  <span className={styles.nearbyText}>Cebalat Ben Ammar</span>
                </div>
                <div className={styles.nearbyItem}>
                  <span className={styles.nearbyIcon}>🍽️</span>
                  <span className={styles.nearbyText}>Rbi Restaurant</span>
                </div>
                <div className={styles.nearbyItem}>
                  <span className={styles.nearbyIcon}>🔧</span>
                  <span className={styles.nearbyText}>El Mecano Garage</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className={styles.footerBottom}>
        <div className={styles.footerBottomContent}>
          <div className={styles.copyright}>
            © {new Date().getFullYear()} Telcotec. All rights reserved.
          </div>
          
          <div className={styles.legalLinks}>
            <Link to="/privacy" className={styles.legalLink}>Privacy Policy</Link>
            <span className={styles.separator}>•</span>
            <Link to="/terms" className={styles.legalLink}>Terms of Service</Link>
            <span className={styles.separator}>•</span>
            <Link to="/sitemap" className={styles.legalLink}>Sitemap</Link>
          </div>

          <div className={styles.madeWith}>
            Made with <span className={styles.heart}>❤️</span> in Tunisia
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;