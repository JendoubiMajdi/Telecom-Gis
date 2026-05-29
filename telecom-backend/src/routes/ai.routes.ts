import { Router } from 'express';
import {
  coverageGapsHandler,
  siteAnalysisHandler,
  upgradeRecommendationHandler,
} from '../controllers/ai.controller';

const router = Router();

router.get('/coverage-gaps', coverageGapsHandler);
router.get('/site-analysis/:id', siteAnalysisHandler);
router.post('/upgrade-recommendation', upgradeRecommendationHandler);  // ← NEW

export default router;