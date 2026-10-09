import { Router } from 'express';
import {
  coverageGapsHandler,
  siteAnalysisHandler,
  upgradeRecommendationHandler,
} from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Analysis tools: any logged-in role.
router.use(authenticate);

router.get('/coverage-gaps', coverageGapsHandler);
router.get('/site-analysis/:id', siteAnalysisHandler);
router.post('/upgrade-recommendation', upgradeRecommendationHandler);

export default router;