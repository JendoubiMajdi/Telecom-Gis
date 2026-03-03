import pool from '../db/database';
import { User, CreateUserInput } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import crypto from 'crypto';

export const userService = {

// Update user profile
updateUser: async (userId: string, updateData: { fullName?: string; password?: string }): Promise<User | null> => {
  try {
    let query = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP';
    const values: any[] = [];
    let paramCount = 1;

    if (updateData.fullName) {
      query += `, full_name = $${paramCount}`;
      values.push(updateData.fullName);
      paramCount++;
    }

    if (updateData.password) {
      const hashedPassword = await hashPassword(updateData.password);
      query += `, password_hash = $${paramCount}`;
      values.push(hashedPassword);
      paramCount++;
    }

    query += ` WHERE id = $${paramCount} RETURNING id, email, password_hash, full_name as "fullName", role, created_at as "createdAt", updated_at as "updatedAt", two_factor_enabled as "twoFactorEnabled", is_email_verified as "isEmailVerified"`;
    values.push(userId);

    const result = await pool.query(query, values);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      user.password = user.password_hash;
      delete user.password_hash;
      return user;
    }
    return null;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
},

// Find user by email
findUserByEmail: async (email: string): Promise<User | null> => {
  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, full_name as "fullName", role, created_at as "createdAt", updated_at as "updatedAt", two_factor_enabled as "twoFactorEnabled", is_email_verified as "isEmailVerified" FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      user.password = user.password_hash;
      delete user.password_hash;
      return user;
    }
    return null;
  } catch (error) {
    console.error('Error finding user by email:', error);
    throw error;
  }
},

// Find user by ID
findUserById: async (id: string): Promise<User | null> => {
  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, full_name as "fullName", role, created_at as "createdAt", updated_at as "updatedAt", two_factor_enabled as "twoFactorEnabled", is_email_verified as "isEmailVerified" FROM users WHERE id = $1',
      [id]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      user.password = user.password_hash;
      delete user.password_hash;
      return user;
    }
    return null;
  } catch (error) {
    console.error('Error finding user by ID:', error);
    throw error;
  }
},


  // Create new user
// Create new user
createUser: async (userData: CreateUserInput): Promise<User> => {
  try {
    const hashedPassword = await hashPassword(userData.password);
    
    // First check if columns exist, use dynamic query
    let query = `
      INSERT INTO users (email, password_hash, full_name, role
    `;
    let values = [userData.email, hashedPassword, userData.fullName, userData.role || 'viewer'];
    let placeholders = 5;
    
    // Try to add optional columns
    try {
      // Check if two_factor_enabled column exists
      const checkColumn = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'two_factor_enabled'
      `);
      
      if (checkColumn.rows.length > 0) {
        query += `, two_factor_enabled`;
        values.push('false');
        placeholders++;
      }
      
      // Check if is_email_verified column exists
      const checkEmailColumn = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_email_verified'
      `);
      
      if (checkEmailColumn.rows.length > 0) {
        query += `, is_email_verified`;
        values.push('false');
        placeholders++;
      }
    } catch (err) {
      console.log('Error checking columns:', err);
    }
    
    query += `) VALUES (`;
    for (let i = 1; i <= values.length; i++) {
      query += `$${i}`;
      if (i < values.length) query += `, `;
    }
    query += `) RETURNING id, email, password_hash as password, full_name as "fullName", role, created_at as "createdAt", updated_at as "updatedAt"`;
    
    // Also try to add 2FA fields to RETURNING if they exist
    try {
      const check2FAColumn = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'two_factor_enabled'
      `);
      if (check2FAColumn.rows.length > 0) {
        query += `, two_factor_enabled as "twoFactorEnabled"`;
      }
      
      const checkEmailVerifiedColumn = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'is_email_verified'
      `);
      if (checkEmailVerifiedColumn.rows.length > 0) {
        query += `, is_email_verified as "isEmailVerified"`;
      }
    } catch (err) {
      console.log('Error checking RETURNING columns:', err);
    }

    const result = await pool.query(query, values);
    
    // Ensure returned user has default values for missing fields
    const user = result.rows[0];
    user.twoFactorEnabled = user.twoFactorEnabled || false;
    user.isEmailVerified = user.isEmailVerified || false;
    
    return user;
  } catch (error: any) {
    console.error('Error creating user:', error);
    
    if (error.code === '23505') {
      throw new Error('Email already exists');
    }
    
    throw error;
  }
},

  // Verify user password
  verifyPassword: async (password: string, hashedPassword: string): Promise<boolean> => {
    return comparePassword(password, hashedPassword);
  },

  // Get all users (for admin)
  getAllUsers: async (): Promise<User[]> => {
    try {
      const result = await pool.query(
        'SELECT id, email, full_name as "fullName", role, created_at as "createdAt", two_factor_enabled as "twoFactorEnabled", is_email_verified as "isEmailVerified" FROM users ORDER BY created_at DESC'
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  },

  // Generate and store OTP
  generateAndStoreOtp: async (email: string, purpose: string = 'login'): Promise<string> => {
    try {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in database (expires in 5 minutes)
      await pool.query(
        `INSERT INTO otp_codes (email, otp_code, expires_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '5 minutes')`,
        [email, otp]
      );

      // Update user's last OTP sent time
      await pool.query(
        `UPDATE users 
         SET last_otp_sent_at = CURRENT_TIMESTAMP
         WHERE email = $1`,
        [email]
      );

      return otp;
    } catch (error) {
      console.error('Error generating OTP:', error);
      throw error;
    }
  },

  // Verify OTP
  verifyOtp: async (email: string, otp: string): Promise<boolean> => {
    try {
      // Find valid OTP (not expired, not used)
      const result = await pool.query(
        `SELECT id FROM otp_codes 
         WHERE email = $1 
         AND otp_code = $2 
         AND expires_at > CURRENT_TIMESTAMP 
         AND used = false
         ORDER BY created_at DESC 
         LIMIT 1`,
        [email, otp]
      );

      if (result.rows.length === 0) {
        return false;
      }

      // Mark OTP as used
      await pool.query(
        'UPDATE otp_codes SET used = true WHERE id = $1',
        [result.rows[0].id]
      );

      return true;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      return false;
    }
  },

  // Create password reset token
  createPasswordResetToken: async (email: string): Promise<string> => {
    try {
      // Generate random token using imported crypto
      const token = crypto.randomBytes(32).toString('hex');
      
      // Store token in database (expires in 15 minutes)
      await pool.query(
        `INSERT INTO password_reset_tokens (email, token, expires_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '15 minutes')`,
        [email, token]
      );

      return token;
    } catch (error) {
      console.error('Error creating reset token:', error);
      throw error;
    }
  },

  // Verify password reset token
  verifyPasswordResetToken: async (token: string): Promise<{ email: string } | null> => {
    try {
      const result = await pool.query(
        `SELECT email FROM password_reset_tokens 
         WHERE token = $1 
         AND expires_at > CURRENT_TIMESTAMP 
         AND used = false
         LIMIT 1`,
        [token]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return { email: result.rows[0].email };
    } catch (error) {
      console.error('Error verifying reset token:', error);
      return null;
    }
  },

  // Use password reset token
  usePasswordResetToken: async (token: string): Promise<void> => {
    try {
      await pool.query(
        'UPDATE password_reset_tokens SET used = true WHERE token = $1',
        [token]
      );
    } catch (error) {
      console.error('Error using reset token:', error);
      throw error;
    }
  },

  // Update login attempts (for account lockout)
  updateLoginAttempts: async (email: string, success: boolean): Promise<void> => {
    try {
      if (success) {
        // Reset attempts on successful login
        await pool.query(
          `UPDATE users 
           SET login_attempts = 0, 
               account_locked_until = NULL 
           WHERE email = $1`,
          [email]
        );
      } else {
        // Increment failed attempts
        await pool.query(
          `UPDATE users 
           SET login_attempts = login_attempts + 1 
           WHERE email = $1
           RETURNING login_attempts`,
          [email]
        );

        // Check if should lock account (after 5 failed attempts)
        const result = await pool.query(
          `SELECT login_attempts FROM users WHERE email = $1`,
          [email]
        );

        if (result.rows.length > 0 && result.rows[0].login_attempts >= 5) {
          // Lock account for 15 minutes
          await pool.query(
            `UPDATE users 
             SET account_locked_until = CURRENT_TIMESTAMP + INTERVAL '15 minutes' 
             WHERE email = $1`,
            [email]
          );
        }
      }
    } catch (error) {
      console.error('Error updating login attempts:', error);
      throw error;
    }
  },

  // Check if account is locked
  isAccountLocked: async (email: string): Promise<boolean> => {
    try {
      const result = await pool.query(
        `SELECT account_locked_until FROM users WHERE email = $1`,
        [email]
      );

      if (result.rows.length === 0) return false;

      const lockedUntil = result.rows[0].account_locked_until;
      if (!lockedUntil) return false;

      return new Date(lockedUntil) > new Date();
    } catch (error) {
      console.error('Error checking account lock:', error);
      return false;
    }
  },

  // Update 2FA settings
  update2FASettings: async (userId: string, enable2FA: boolean): Promise<void> => {
    try {
      await pool.query(
        'UPDATE users SET two_factor_enabled = $1 WHERE id = $2',
        [enable2FA, userId]
      );
    } catch (error) {
      console.error('Error updating 2FA settings:', error);
      throw error;
    }
  },

  // Mark email as verified
  verifyEmail: async (email: string): Promise<void> => {
    try {
      await pool.query(
        'UPDATE users SET is_email_verified = true WHERE email = $1',
        [email]
      );
    } catch (error) {
      console.error('Error verifying email:', error);
      throw error;
    }
  },

  // Clean expired tokens and OTPs (can be run periodically)
  cleanExpiredTokens: async (): Promise<void> => {
    try {
      await pool.query(
        `DELETE FROM otp_codes WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'`
      );
      await pool.query(
        `DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 hour'`
      );
    } catch (error) {
      console.error('Error cleaning expired tokens:', error);
    }
  }
};