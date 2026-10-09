import { Router } from 'express';
import {
  getSites,
  getSite,
  getStats,
  createSite,
  updateSiteHandler,
  deleteSiteHandler,
} from '../controllers/network.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Every network route requires a valid login.
router.use(authenticate);

// Read access: any logged-in role.
router.get('/sites', getSites);
router.get('/sites/:id', getSite);
router.get('/stats', getStats);

// Write access: admin only (operator proposals + approval come in a later step).
router.post('/sites', requireRole('admin'), createSite);
router.put('/sites/:id', requireRole('admin'), updateSiteHandler);
router.delete('/sites/:id', requireRole('admin'), deleteSiteHandler);

export default router;