import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
  summaryHandler,
  listUsersHandler,
  updateUserRoleHandler,
  updateUserActiveHandler,
  auditLogHandler,
} from '../controllers/admin.controller';

const router = Router();

// Everything under /api/admin is admin-only.
router.use(authenticate, requireRole('admin'));

router.get('/summary', summaryHandler);
router.get('/users', listUsersHandler);
router.patch('/users/:id/role', updateUserRoleHandler);
router.patch('/users/:id/active', updateUserActiveHandler);
router.get('/audit', auditLogHandler);

export default router;