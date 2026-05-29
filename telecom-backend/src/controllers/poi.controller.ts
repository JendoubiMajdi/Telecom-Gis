import { Request, Response } from 'express';
import { checkPoiCoverage, PoiPoint } from '../services/poi.service';

// ── POST /api/poi/check ────────────────────────────────────────────────────────
// Body: { pois: PoiPoint[], radiusKm: number }
// Browser fetches POIs from Overpass, sends them here for PostGIS coverage check
export const poiCheckHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { pois, radiusKm } = req.body;

    if (!Array.isArray(pois) || pois.length === 0) {
      res.status(400).json({ error: 'pois must be a non-empty array' });
      return;
    }

    if (pois.length > 5000) {
      res.status(400).json({ error: 'Too many POIs — max 5000 per request' });
      return;
    }

    const radius = parseFloat(radiusKm);
    if (isNaN(radius) || radius < 0.5 || radius > 20) {
      res.status(400).json({ error: 'radiusKm must be between 0.5 and 20' });
      return;
    }

    const results = await checkPoiCoverage(pois as PoiPoint[], radius);
    res.json(results);
  } catch (err: any) {
    console.error('poiCheck error:', err);
    res.status(500).json({ error: 'PostGIS coverage check failed', detail: err?.message });
  }
};