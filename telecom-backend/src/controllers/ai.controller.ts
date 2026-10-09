import { Request, Response } from 'express';
import {
  getCoverageGaps,
  getSiteAnalysisData,
  getUpgradeRecommendation,
} from '../services/ai.service';

// ── GET /api/ai/coverage-gaps?gridStep=0.15&minGapKm=8 ────────────────────────
export const coverageGapsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const gridStep = parseFloat(req.query.gridStep as string) || 0.15;
    const minGapKm = parseFloat(req.query.minGapKm as string) || 8;
    const safeStep  = Math.max(0.05, Math.min(0.5, gridStep));
    const safeGapKm = Math.max(1, Math.min(100, minGapKm));
    const gaps = await getCoverageGaps(safeStep, safeGapKm);
    res.json({ count: gaps.length, gaps });
  } catch (err: any) {
    console.error('coverageGaps error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
};

// ── GET /api/ai/site-analysis/:id ─────────────────────────────────────────────
export const siteAnalysisHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const siteId = parseInt(req.params.id as string);
    if (isNaN(siteId)) { res.status(400).json({ error: 'Invalid site id' }); return; }
    const data = await getSiteAnalysisData(siteId);
    if (!data) { res.status(404).json({ error: 'Site not found' }); return; }
    res.json(data);
  } catch (err: any) {
    console.error('siteAnalysis error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
};

// ── POST /api/ai/upgrade-recommendation ───────────────────────────────────────
// Body: { siteId: number }
// Calls the Claude API server-side — API key never touches the browser.
export const upgradeRecommendationHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const siteId = parseInt(req.body.siteId as string);
    if (isNaN(siteId)) { res.status(400).json({ error: 'Invalid siteId in request body' }); return; }

    const result = await getUpgradeRecommendation(siteId);
    res.json(result);
  } catch (err: any) {
    console.error('upgradeRecommendation error:', err);

    const msg: string = err?.message ?? '';

    if (msg.includes('ANTHROPIC_API_KEY')) {
      res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY in .env (restart the backend after adding it)' });
      return;
    }
    if (msg.startsWith('Site not found')) {
      res.status(404).json({ error: 'Site not found, or it has no cells to analyse' });
      return;
    }
    if (msg.startsWith('Claude API error 401')) {
      res.status(502).json({ error: 'Anthropic rejected the API key (invalid or revoked). Check ANTHROPIC_API_KEY in .env' });
      return;
    }
    if (msg.startsWith('Claude API error 404')) {
      res.status(502).json({ error: 'The AI model was not found. Set ANTHROPIC_MODEL in .env to a model your key can use', detail: msg });
      return;
    }
    if (msg.startsWith('Claude API error')) {
      res.status(502).json({ error: 'The AI service returned an error', detail: msg });
      return;
    }
    res.status(500).json({ error: 'Failed to get recommendation', detail: msg });
  }
};