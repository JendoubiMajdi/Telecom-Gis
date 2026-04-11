import { Router } from 'express';
import { getSites, getSite, getStats } from '../controllers/network.controller';

const router = Router();

router.get('/sites', getSites);
router.get('/sites/:id', getSite);
router.get('/stats', getStats);

export default router;