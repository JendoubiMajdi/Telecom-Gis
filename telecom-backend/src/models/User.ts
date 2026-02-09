export interface User {
  id?: string;
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'operator' | 'viewer';
  createdAt?: Date;
  updatedAt?: Date;
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