export interface User {
  id?: string;
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'operator' | 'viewer';
  createdAt?: Date;
  updatedAt?: Date;
  
  // New fields for 2FA and security
  isEmailVerified?: boolean;
  twoFactorEnabled?: boolean;
  lastOtpSentAt?: Date;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  loginAttempts?: number;
  accountLockedUntil?: Date | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  role?: 'admin' | 'operator' | 'viewer';
}

export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: Date;
  isEmailVerified?: boolean;
  twoFactorEnabled?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  role?: 'admin' | 'operator' | 'viewer';
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface SendOtpRequest {
  email: string;
  purpose?: 'login' | 'reset-password' | 'verify-email';
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
  purpose?: 'login' | 'reset-password' | 'verify-email';
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface Update2FASettings {
  enable2FA: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}