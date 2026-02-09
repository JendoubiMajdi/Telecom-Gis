import { User } from '../models/User';
import { hashPassword } from './password';

const users: User[] = [];

export const initializeMockUsers = async () => {
  if (users.length === 0) {
    const adminPassword = await hashPassword('Admin123!');
    users.push({
      id: '1',
      email: 'admin@telecom.cm',
      password: adminPassword,
      fullName: 'System Administrator',
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(' Mock users initialized');
  }
};

export const findUserByEmail = (email: string): User | undefined => {
  return users.find(user => user.email === email);
};

export const findUserById = (id: string): User | undefined => {
  return users.find(user => user.id === id);
};

export const createUser = async (userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> => {
  const newUser: User = {
    id: (users.length + 1).toString(),
    ...userData,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  users.push(newUser);
  return newUser;
};

export const getAllUsers = (): User[] => {
  return [...users];
};