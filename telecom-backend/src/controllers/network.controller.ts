import { Request, Response } from 'express';
import {
  getSitesGeoJSON,
  getSiteDetail,
  getNetworkStats,
} from '../services/network.service';

// ── GET /api/network/sites?bbox=lng1,lat1,lng2,lat2&technology=4G ──
export const getSites = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bbox, technology } = req.query;

    if (!bbox || typeof bbox !== 'string') {
      res.status(400).json({ error: 'bbox query parameter is required (lng1,lat1,lng2,lat2)' });
      return;
    }

    const parts = bbox.split(',').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      res.status(400).json({ error: 'bbox must be 4 comma-separated numbers: lng1,lat1,lng2,lat2' });
      return;
    }

    const [lng1, lat1, lng2, lat2] = parts;

    const tech = Array.isArray(technology)
      ? String(technology[0])
      : typeof technology === 'string'
      ? technology
      : undefined;

    const geojson = await getSitesGeoJSON({
      lng1, lat1, lng2, lat2,
      technology: tech,
    });

    res.json(geojson);
  } catch (err) {
    console.error('getSites error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/network/sites/:id ─────────────────────────────
export const getSite = async (req: Request, res: Response): Promise<void> => {
  try {
    const siteId = parseInt(req.params.id as string);

    if (isNaN(siteId)) {
      res.status(400).json({ error: 'Invalid site id' });
      return;
    }

    const site = await getSiteDetail(siteId);

    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    res.json(site);
  } catch (err) {
    console.error('getSite error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/network/stats ─────────────────────────────────
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getNetworkStats();
    res.json(stats);
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};