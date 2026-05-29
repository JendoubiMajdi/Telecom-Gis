import { Router } from 'express';
import { poiCheckHandler } from '../controllers/poi.controller';

const router = Router();

// POST /api/poi/check  — browser sends POIs, backend returns coverage results
router.post('/check', poiCheckHandler);

export default router;