import { Router } from 'express';
import {
  getSites,
  getSite,
  getStats,
  createSite,
  updateSiteHandler,
  deleteSiteHandler,
} from '../controllers/network.controller';

const router = Router();

router.get('/sites', getSites);
router.get('/sites/:id', getSite);
router.post('/sites', createSite);
router.put('/sites/:id', updateSiteHandler);
router.delete('/sites/:id', deleteSiteHandler);
router.get('/stats', getStats);

export default router;