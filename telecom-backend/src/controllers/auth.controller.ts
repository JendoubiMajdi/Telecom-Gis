import { Request, Response } from 'express';
import { 
  LoginCredentials, 
  RegisterData, 
  UserResponse, 
  SendOtpRequest, 
  VerifyOtpRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest
} from '../models/User';
import { JwtPayload } from '../models/JwtPayload';
import { generateToken } from '../utils/jwt';
import { userService } from '../services/user.service';
import { emailService } from '../utils/emailService';

// Helper function to convert user to response
const toUserResponse = (user: any): UserResponse => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  createdAt: user.createdAt,
  isEmailVerified: user.isEmailVerified || false,
  twoFactorEnabled: user.twoFactorEnabled || false
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

export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, purpose = 'login' }: SendOtpRequest = req.body;

    if (!email) {
      res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
      return;
    }

    // Check if user exists
    const user = await userService.findUserByEmail(email);
    if (!user) {
      res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

    // Check if account is locked
    const isLocked = await userService.isAccountLocked(email);
    if (isLocked) {
      res.status(423).json({ 
        success: false,
        message: 'Account is temporarily locked. Please try again later.' 
      });
      return;
    }

    // Generate and store OTP
    const otp = await userService.generateAndStoreOtp(email, purpose);
    
    // Send OTP via email
    const emailSent = await emailService.sendOtpEmail(email, otp, purpose);
    
    // Log to console if email failed (for development)
    if (!emailSent && process.env.NODE_ENV !== 'production') {
      console.log(`📧 [DEV] OTP for ${email}: ${otp} (Purpose: ${purpose})`);
    }

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        // Only include OTP in non-production for testing
        otp: process.env.NODE_ENV !== 'production' ? otp : undefined
      }
    });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send OTP' 
    });
  }
};

export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, otp, purpose = 'login' }: VerifyOtpRequest = req.body;

    if (!email || !otp) {
      res.status(400).json({ 
        success: false,
        message: 'Email and OTP are required' 
      });
      return;
    }

    // Verify OTP
    const isValid = await userService.verifyOtp(email, otp);
    
    if (!isValid) {
      res.status(400).json({ 
        success: false,
        message: 'Invalid or expired OTP' 
      });
      return;
    }

    // If OTP is for login, generate token
    if (purpose === 'login') {
      const user = await userService.findUserByEmail(email);
      if (!user) {
        res.status(404).json({ 
          success: false,
          message: 'User not found' 
        });
        return;
      }

      const tokenPayload: JwtPayload = {
        userId: user.id!,
        email: user.email,
        role: user.role
      };
      const token = generateToken(tokenPayload);

      // Reset login attempts on successful OTP verification
      await userService.updateLoginAttempts(email, true);

      res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
        data: {
          token,
          user: toUserResponse(user)
        }
      });
    } else {
      // For other purposes (password reset, email verification)
      res.status(200).json({
        success: true,
        message: 'OTP verified successfully'
      });
    }

  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to verify OTP' 
    });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email }: ForgotPasswordRequest = req.body;

    if (!email) {
      res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
      return;
    }

    // Check if user exists
    const user = await userService.findUserByEmail(email);
    if (!user) {
      // Don't reveal that user doesn't exist for security
      res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a reset link will be sent'
      });
      return;
    }

    // Generate reset token
    const resetToken = await userService.createPasswordResetToken(email);
    
    // Create reset link
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    // Send reset email
    const emailSent = await emailService.sendResetEmail(email, resetLink);
    
    // Log to console if email failed
    if (!emailSent && process.env.NODE_ENV !== 'production') {
      console.log(`📧 [DEV] Reset link for ${email}: ${resetLink}`);
    }

    res.status(200).json({
      success: true,
      message: 'Password reset instructions sent',
      data: {
        // In production, don't send token in response
        // For demo only:
        resetToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined,
        resetLink: process.env.NODE_ENV !== 'production' ? resetLink : undefined
      }
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to process password reset request' 
    });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword }: ResetPasswordRequest = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ 
        success: false,
        message: 'Token and new password are required' 
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ 
        success: false,
        message: 'Password must be at least 6 characters' 
      });
      return;
    }

    // Verify token
    const tokenData = await userService.verifyPasswordResetToken(token);
    if (!tokenData) {
      res.status(400).json({ 
        success: false,
        message: 'Invalid or expired reset token' 
      });
      return;
    }

    // Update password
    const user = await userService.findUserByEmail(tokenData.email);
    if (!user) {
      res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
      return;
    }

    // Update user password
    const updatedUser = await userService.updateUser(user.id!, { password: newPassword });
    if (!updatedUser) {
      res.status(500).json({ 
        success: false,
        message: 'Failed to reset password' 
      });
      return;
    }

    // Mark token as used
    await userService.usePasswordResetToken(token);

    // Invalidate all user sessions (optional)
    // You could add token blacklisting here

    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to reset password' 
    });
  }
};

export const verifyEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token }: { token: string } = req.body;

    if (!token) {
      res.status(400).json({ 
        success: false,
        message: 'Verification token is required' 
      });
      return;
    }

    // In a real implementation, you would verify an email token
    // For now, we'll use OTP verification for email too
    res.status(200).json({
      success: true,
      message: 'Email verification endpoint - implement token verification'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to verify email' 
    });
  }
};

export const check2FAStatus = async (req: Request, res: Response): Promise<void> => {
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
      data: {
        twoFactorEnabled: user.twoFactorEnabled || false,
        isEmailVerified: user.isEmailVerified || false
      }
    });

  } catch (error) {
    console.error('Check 2FA status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to check 2FA status' 
    });
  }
};