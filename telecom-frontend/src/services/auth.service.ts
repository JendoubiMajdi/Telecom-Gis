import axios from 'axios';

const API_URL = 'http://localhost:5000/api/auth';

axios.defaults.baseURL = 'http://localhost:5000';

const api = axios.create({
  baseURL: 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
  isEmailVerified?: boolean;
  twoFactorEnabled?: boolean;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData extends LoginData {
  fullName: string;
  role?: 'admin' | 'operator' | 'viewer';
}

export interface UpdateProfileData {
  fullName?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  token: string;
}

export interface UpdateProfileResponse {
  message: string;
  user: User;
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

export interface SendOtpResponse {
  success: boolean;
  message: string;
  data?: {
    otp?: string; 
  };
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  data?: {
    token?: string;
    user?: User;
  };
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  data?: {
    resetToken?: string; 
    resetLink?: string; 
  };
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

export interface TwoFAStatusResponse {
  success: boolean;
  data: {
    twoFactorEnabled: boolean;
    isEmailVerified: boolean;
  };
}


export const authService = {
  register: async (userData: RegisterData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(`${API_URL}/register`, userData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  login: async (credentials: LoginData): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(`${API_URL}/login`, credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<{ user: User }>(`${API_URL}/me`);
    return response.data.user;
  },

  updateProfile: async (profileData: UpdateProfileData): Promise<UpdateProfileResponse> => {
    const response = await api.put<UpdateProfileResponse>(`${API_URL}/profile`, profileData);
    
    if (response.data.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  },

  logout: (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },

  getToken: (): string | null => {
    return localStorage.getItem('token');
  },

  getUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  
  // Send OTP to email
  sendOtp: async (email: string, purpose: string = 'login'): Promise<SendOtpResponse> => {
    const response = await api.post<SendOtpResponse>(`${API_URL}/send-otp`, { email, purpose });
    return response.data;
  },

  // Verify OTP code
  verifyOtp: async (email: string, otp: string, purpose: string = 'login'): Promise<VerifyOtpResponse> => {
    const response = await api.post<VerifyOtpResponse>(`${API_URL}/verify-otp`, { 
      email, 
      otp, 
      purpose 
    });
    
    // If OTP is for login and successful, store token
    if (response.data.success && purpose === 'login' && response.data.data?.token) {
      localStorage.setItem('token', response.data.data.token);
      if (response.data.data.user) {
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
      }
    }
    
    return response.data;
  },

  // Request password reset
  forgotPassword: async (email: string): Promise<ForgotPasswordResponse> => {
    const response = await api.post<ForgotPasswordResponse>(`${API_URL}/forgot-password`, { email });
    return response.data;
  },

  // Reset password with token
  resetPassword: async (token: string, newPassword: string): Promise<ResetPasswordResponse> => {
    const response = await api.post<ResetPasswordResponse>(`${API_URL}/reset-password`, { 
      token, 
      newPassword 
    });
    return response.data;
  },

  // Verify email
  verifyEmail: async (token: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`${API_URL}/verify-email`, { token });
    return response.data;
  },

  // Check 2FA status (requires authentication)
  check2FAStatus: async (): Promise<TwoFAStatusResponse> => {
    const response = await api.get<TwoFAStatusResponse>(`${API_URL}/2fa-status`);
    return response.data;
  },

  // Check if user has 2FA enabled
  has2FAEnabled: (): boolean => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return false;
    const user: User = JSON.parse(userStr);
    return user?.twoFactorEnabled || false;
  },

  // Check if email is verified
  isEmailVerified: (): boolean => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return false;
    const user: User = JSON.parse(userStr);
    return user?.isEmailVerified || false;
  },

  // Update user in localStorage
  updateLocalUser: (updatedUser: Partial<User>): void => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const currentUser: User = JSON.parse(userStr);
      const newUser = { ...currentUser, ...updatedUser };
      localStorage.setItem('user', JSON.stringify(newUser));
    }
  }
};

export default authService;