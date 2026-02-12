import { Router } from 'express';
import { 
  register, 
  login, 
  getCurrentUser, 
  updateProfile,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  verifyEmail,
  check2FAStatus
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public routes (no authentication required)
router.post('/register', register);
router.post('/login', login);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);

// Protected routes (authentication required)
router.put('/profile', authenticate, updateProfile);
router.get('/me', authenticate, getCurrentUser);
router.get('/2fa-status', authenticate, check2FAStatus);

export default router;