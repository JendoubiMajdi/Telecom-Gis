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
    
    // Update localStorage with new user data
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
};

export default authService;