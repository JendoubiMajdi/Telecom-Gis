import { Router } from 'express';
import { register, login, getCurrentUser, updateProfile } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.put('/profile', authenticate, updateProfile);
router.get('/me', authenticate, getCurrentUser);
export default router;