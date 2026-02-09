import { Request } from 'express';
import { User } from './User';

export interface AuthRequest extends Request {
  user?: User;
  userId?: string;
}