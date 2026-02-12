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
  
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, role: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  
  updateProfile: (data: UpdateProfileData) => Promise<{ message: string; user: User }>;
  
  sendOtp: (email: string, purpose?: string) => Promise<SendOtpResponse>;
  verifyOtp: (email: string, otp: string, purpose?: string) => Promise<VerifyOtpResponse>;
  forgotPassword: (email: string) => Promise<ForgotPasswordResponse>;
  resetPassword: (token: string, newPassword: string) => Promise<ResetPasswordResponse>;
  check2FAStatus: () => Promise<TwoFAStatusResponse>;
  
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
          setUser(currentUser);
          setToken(storedToken);
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
      setUser(response.user);
      setToken(response.token);
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
      setUser(response.user);
      setToken(response.token);
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
      setUser(response.user);
      authService.updateLocalUser(response.user);
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
          setUser(updatedUser);
          setToken(response.data.token);
          authService.updateLocalUser(updatedUser);
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
    
    has2FAEnabled,
    isEmailVerified,
    
    updateUserState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};