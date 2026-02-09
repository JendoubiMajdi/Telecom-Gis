import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AuthRequest } from '../models/AuthRequest';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    const decoded = verifyToken(token);

    (req as AuthRequest).userId = decoded.userId;
    (req as AuthRequest).user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role as 'admin' | 'operator' | 'viewer',
      password: '', 
      fullName: '' 
    };

    next();

  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};