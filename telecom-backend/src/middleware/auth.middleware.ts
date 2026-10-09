import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AuthRequest } from '../models/AuthRequest';
import { JwtPayload } from '../models/JwtPayload';
import { getUserAuthState } from '../services/admin.service';

export type Role = 'admin' | 'operator' | 'viewer';

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // 1) Validate the token itself
  let decoded: JwtPayload;
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    decoded = verifyToken(authHeader.split(' ')[1]);
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // 2) Check the account in the database on every request, so that a role change
  //    or a deactivation by an admin takes effect immediately (not at next login).
  try {
    const state = await getUserAuthState(decoded.userId);

    if (!state) {
      res.status(401).json({ error: 'This account no longer exists' });
      return;
    }
    if (!state.isActive) {
      res.status(403).json({ error: 'This account has been deactivated', code: 'ACCOUNT_DISABLED' });
      return;
    }

    (req as AuthRequest).userId = decoded.userId;
    (req as AuthRequest).user = {
      id: decoded.userId,
      email: decoded.email,
      role: state.role as Role,   // role comes from the database, not from the token
      password: '',
      fullName: ''
    };

    next();
  } catch (error) {
    console.error('Account check failed:', error);
    res.status(500).json({ error: 'Could not verify your account. Please try again.' });
  }
};

// ── Role-based access control ──────────────────────────────────────────────────
// Usage: router.delete('/x', authenticate, requireRole('admin'), handler)
// Must be placed AFTER authenticate (it reads the role that authenticate set).
export const requireRole = (...allowed: Role[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const role = (req as AuthRequest).user?.role;
    if (!role || !allowed.includes(role)) {
      res.status(403).json({
        error: 'You do not have permission to perform this action',
        requiredRole: allowed,
      });
      return;
    }
    next();
  };