import { Request, Response } from 'express';
import { LoginCredentials, RegisterData, UserResponse } from '../models/User';
import { JwtPayload } from '../models/JwtPayload';
import { generateToken } from '../utils/jwt';
import { userService } from '../services/user.service';

const toUserResponse = (user: any): UserResponse => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  createdAt: user.createdAt
});

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any;
    const userId = authReq.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: 'Not authenticated' 
      });
      return;
    }

    const { fullName, currentPassword, newPassword } = req.body;

    // Validate input
    if (!fullName && !currentPassword && !newPassword) {
      res.status(400).json({ 
        success: false,
        message: 'No changes provided' 
      });
      return;
    }

    // Get current user
    const user = await userService.findUserById(userId);
    if (!user) {
      res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ 
          success: false,
          message: 'Current password is required to set new password' 
        });
        return;
      }

      const isValidPassword = await userService.verifyPassword(currentPassword, user.password);
      if (!isValidPassword) {
        res.status(401).json({ 
          success: false,
          message: 'Current password is incorrect' 
        });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ 
          success: false,
          message: 'New password must be at least 6 characters' 
        });
        return;
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (fullName && fullName !== user.fullName) {
      updateData.fullName = fullName;
    }
    if (newPassword) {
      updateData.password = newPassword;
    }

    // Update user in database
    const updatedUser = await userService.updateUser(userId, updateData);
    if (!updatedUser) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to update profile' 
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: toUserResponse(updatedUser)
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, fullName, role = 'viewer' }: RegisterData = req.body;

    if (!email || !password || !fullName) {
      res.status(400).json({ 
        success: false,
        message: 'Email, password, and full name are required' 
      });
      return;
    }

    // Check if user already exists
    const existingUser = await userService.findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ 
        success: false,
        message: 'User already exists' 
      });
      return;
    }

    // Create user in database
    const user = await userService.createUser({
      email,
      password,
      fullName,
      role: role as 'admin' | 'operator' | 'viewer'
    });

    const tokenPayload: JwtPayload = {
      userId: user.id!,
      email: user.email,
      role: user.role
    };
    const token = generateToken(tokenPayload);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: toUserResponse(user),
      token
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    
    if (error.message === 'Email already exists') {
      res.status(409).json({ 
        success: false,
        message: 'Email already exists' 
      });
      return;
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginCredentials = req.body;

    if (!email || !password) {
      res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
      return;
    }

    // Find user in database
    const user = await userService.findUserByEmail(email);
    if (!user) {
      res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
      return;
    }

    // Verify password
    const isValidPassword = await userService.verifyPassword(password, user.password);
    if (!isValidPassword) {
      res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
      return;
    }

    const tokenPayload: JwtPayload = {
      userId: user.id!,
      email: user.email,
      role: user.role
    };
    const token = generateToken(tokenPayload);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: toUserResponse(user),
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as any; 
    const userId = authReq.userId;
    
    if (!userId) {
      res.status(401).json({ 
        success: false,
        message: 'Not authenticated' 
      });
      return;
    }

    const user = await userService.findUserById(userId);
    if (!user) {
      res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: toUserResponse(user)
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};