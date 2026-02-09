import pool from '../db/database';
import { User, CreateUserInput } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';

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

    query += ` WHERE id = $${paramCount} RETURNING id, email, password_hash as password, full_name as "fullName", role, created_at as "createdAt", updated_at as "updatedAt"`;
    values.push(userId);

    const result = await pool.query(query, values);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
},
  // Find user by email
  findUserByEmail: async (email: string): Promise<User | null> => {
    try {
      const result = await pool.query(
        'SELECT id, email, password_hash as password, full_name as "fullName", role, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE email = $1',
        [email]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  },

  // Find user by ID
  findUserById: async (id: string): Promise<User | null> => {
    try {
      const result = await pool.query(
        'SELECT id, email, password_hash as password, full_name as "fullName", role, created_at as "createdAt", updated_at as "updatedAt" FROM users WHERE id = $1',
        [id]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  },

  // Create new user
  createUser: async (userData: CreateUserInput): Promise<User> => {
    try {
      const hashedPassword = await hashPassword(userData.password);
      
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, email, password_hash as password, full_name as "fullName", role, created_at as "createdAt", updated_at as "updatedAt"`,
        [userData.email, hashedPassword, userData.fullName, userData.role || 'viewer']
      );
      
      return result.rows[0];
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // Handle duplicate email error
      if (error.code === '23505') { // PostgreSQL unique violation
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
        'SELECT id, email, full_name as "fullName", role, created_at as "createdAt" FROM users ORDER BY created_at DESC'
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }
};