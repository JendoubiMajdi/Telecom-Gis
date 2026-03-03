import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authService, { 
  User, 
  UpdateProfileData,
  SendOtpResponse,
  VerifyOtpResponse,
  ForgotPasswordResponse,
  ResetPasswordResponse,
  TwoFAStatusResponse
} from '../services/auth.service';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  
  // Authentication
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  
  // Profile
  updateProfile: (data: UpdateProfileData) => Promise<{ message: string; user: User }>;
  
  // 2FA & Security
  sendOtp: (email: string, purpose?: string) => Promise<SendOtpResponse>;
  verifyOtp: (email: string, otp: string, purpose?: string) => Promise<VerifyOtpResponse>;
  forgotPassword: (email: string) => Promise<ForgotPasswordResponse>;
  resetPassword: (token: string, newPassword: string) => Promise<ResetPasswordResponse>;
  check2FAStatus: () => Promise<TwoFAStatusResponse>;
  toggle2FA: (enable2FA: boolean, password?: string) => Promise<any>; // ✅ ADDED
  
  // 2FA State Management
  isVerifyingOTP: () => boolean;
  setVerifyingOTP: (value: boolean) => void;
  
  // User State
  has2FAEnabled: () => boolean;
  isEmailVerified: () => boolean;
  updateUserState: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(authService.getUser());
  const [token, setToken] = useState<string | null>(authService.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = authService.getToken();
      const storedUser = authService.getUser();

      if (storedToken && storedUser) {
        try {
          const currentUser = await authService.getCurrentUser();
          
          // Ensure 2FA field exists
          const userWith2FA = {
            ...currentUser,
            twoFactorEnabled: currentUser.twoFactorEnabled || false
          };
          
          setUser(userWith2FA);
          setToken(storedToken);
          authService.updateLocalUser(userWith2FA);
          
          // Check if user needs to verify OTP
          const isVerifying = sessionStorage.getItem('isVerifyingOTP') === 'true';
          const pathname = window.location.pathname;
          
          // If user is on OTP page, don't redirect
          if (pathname === '/otp-verification') {
            return;
          }
          
          // If user has 2FA enabled and is in verification process, redirect to OTP
          if (userWith2FA.twoFactorEnabled && isVerifying) {
            window.location.href = '/otp-verification';
            return;
          }
          
        } catch (error) {
          authService.logout();
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });
      
      // Ensure user object has twoFactorEnabled
      const userWith2FA = {
        ...response.user,
        twoFactorEnabled: response.user.twoFactorEnabled || false
      };
      
      setUser(userWith2FA);
      setToken(response.token);
      
      // Update localStorage with complete user object
      localStorage.setItem('user', JSON.stringify(userWith2FA));
      localStorage.setItem('token', response.token);
      
    } catch (error) {
      throw error;
    }
  };

  const register = async (email: string, password: string, fullName: string, role: string = 'viewer') => {
    try {
      const response = await authService.register({ 
        email, 
        password, 
        fullName, 
        role: role as 'admin' | 'operator' | 'viewer' 
      });
      
      // Ensure user object has twoFactorEnabled on register
      const userWith2FA = {
        ...response.user,
        twoFactorEnabled: response.user.twoFactorEnabled || false
      };
      
      setUser(userWith2FA);
      setToken(response.token);
      
      // Update localStorage
      localStorage.setItem('user', JSON.stringify(userWith2FA));
      localStorage.setItem('token', response.token);
      
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setToken(null);
  };

  const updateProfile = async (data: UpdateProfileData) => {
    try {
      const response = await authService.updateProfile(data);
      
      // Ensure 2FA field exists
      const updatedUser = {
        ...response.user,
        twoFactorEnabled: response.user.twoFactorEnabled || false
      };
      
      setUser(updatedUser);
      authService.updateLocalUser(updatedUser);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const sendOtp = async (email: string, purpose: string = 'login'): Promise<SendOtpResponse> => {
    try {
      const response = await authService.sendOtp(email, purpose);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const verifyOtp = async (email: string, otp: string, purpose: string = 'login'): Promise<VerifyOtpResponse> => {
    try {
      const response = await authService.verifyOtp(email, otp, purpose);
      
      if (response.success && purpose === 'login' && response.data?.token) {
        const updatedUser = response.data.user || user;
        if (updatedUser) {
          // Ensure 2FA field exists
          const userWith2FA = {
            ...updatedUser,
            twoFactorEnabled: updatedUser.twoFactorEnabled || false
          };
          setUser(userWith2FA);
          setToken(response.data.token);
          authService.updateLocalUser(userWith2FA);
        }
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  const forgotPassword = async (email: string): Promise<ForgotPasswordResponse> => {
    try {
      const response = await authService.forgotPassword(email);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (token: string, newPassword: string): Promise<ResetPasswordResponse> => {
    try {
      const response = await authService.resetPassword(token, newPassword);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const check2FAStatus = async (): Promise<TwoFAStatusResponse> => {
    try {
      const response = await authService.check2FAStatus();
      
      if (response.success && user) {
        const updatedUser = {
          ...user,
          twoFactorEnabled: response.data.twoFactorEnabled,
          isEmailVerified: response.data.isEmailVerified
        };
        setUser(updatedUser);
        authService.updateLocalUser(updatedUser);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  };

  const toggle2FA = async (enable2FA: boolean, password: string = ''): Promise<any> => {
    try {
      const response = await authService.toggle2FA(enable2FA, password);
      return response;
    } catch (error) {
      throw error;
    }
  };

  const has2FAEnabled = (): boolean => {
    return authService.has2FAEnabled();
  };

  const isEmailVerified = (): boolean => {
    return authService.isEmailVerified();
  };

  const updateUserState = (updatedUser: Partial<User>) => {
    if (user) {
      const newUser = { ...user, ...updatedUser };
      setUser(newUser);
      authService.updateLocalUser(newUser);
    }
  };

  // 2FA State Management
  const isVerifyingOTP = (): boolean => {
    return sessionStorage.getItem('isVerifyingOTP') === 'true';
  };

  const setVerifyingOTP = (value: boolean): void => {
    if (value) {
      sessionStorage.setItem('isVerifyingOTP', 'true');
    } else {
      sessionStorage.removeItem('isVerifyingOTP');
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    
    login,
    register,
    logout,
    isAuthenticated: !!token,
    
    updateProfile,
    
    sendOtp,
    verifyOtp,
    forgotPassword,
    resetPassword,
    check2FAStatus,
    toggle2FA,
    
    isVerifyingOTP,
    setVerifyingOTP,
    
    has2FAEnabled,
    isEmailVerified,
    
    updateUserState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};