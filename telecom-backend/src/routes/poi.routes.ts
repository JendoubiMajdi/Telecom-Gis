import { Router } from 'express';
import { poiCheckHandler } from '../controllers/poi.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// POST /api/poi/check  — browser sends POIs, backend returns coverage results
router.post('/check', poiCheckHandler);

export default router;