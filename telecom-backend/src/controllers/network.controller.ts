import { Request, Response } from 'express';
import {
  getSitesGeoJSON,
  getSiteDetail,
  getNetworkStats,
  createSiteWithCell,
  updateSite as updateSiteService,
  deleteSite as deleteSiteService,
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

    const geojson = await getSitesGeoJSON({ lng1, lat1, lng2, lat2, technology: tech });
    res.json(geojson);
  } catch (err: any) {
    console.error('getSites error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err?.message });
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
  } catch (err: any) {
    console.error('getSite error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
};

// ── POST /api/network/sites ────────────────────────────────
export const createSite = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      site_name,
      region,
      address,       // optional
      longitude,
      latitude,
      technology,
      cell_name,
      cell_index,
      azimuth,
      activity_status,
    } = req.body;

    // ── Validate required fields ──────────────────────────
    const missing: string[] = [];
    if (!site_name)          missing.push('site_name');
    if (!technology)         missing.push('technology');
    if (!cell_name)          missing.push('cell_name');
    if (longitude == null)   missing.push('longitude');
    if (latitude == null)    missing.push('latitude');

    if (missing.length > 0) {
      res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
      return;
    }

    // ── Validate coordinate ranges ─────────────────────────
    const lng = Number(longitude);
    const lat = Number(latitude);

    if (isNaN(lng) || isNaN(lat)) {
      res.status(400).json({ error: 'longitude and latitude must be valid numbers' });
      return;
    }
    if (lat < -90 || lat > 90) {
      res.status(400).json({ error: `Latitude ${lat} is out of range (-90 to 90)` });
      return;
    }
    if (lng < -180 || lng > 180) {
      res.status(400).json({ error: `Longitude ${lng} is out of range (-180 to 180)` });
      return;
    }

    // ── Validate technology value ──────────────────────────
    const VALID_TECHNOLOGIES = ['2G', '3G', '4G', '5G', '5G_FDD', '5G_TDD'];
    if (!VALID_TECHNOLOGIES.includes(technology)) {
      res.status(400).json({
        error: `Invalid technology "${technology}". Must be one of: ${VALID_TECHNOLOGIES.join(', ')}`,
      });
      return;
    }

    const result = await createSiteWithCell({
      site_name:       String(site_name).trim(),
      region:          region ? String(region).trim() : '',
      address:         address ? String(address).trim() : '',
      longitude:       lng,
      latitude:        lat,
      technology:      String(technology),
      cell_name:       String(cell_name).trim(),
      cell_index:      Number(cell_index) || 0,
      azimuth:         Number(azimuth) || 0,
      activity_status: activity_status || 'active',
    });

    res.status(201).json({ message: 'Site and cell created successfully', ...result });
  } catch (err: any) {
    console.error('createSite error:', err);

    // Surface specific PostgreSQL errors to help debugging
    if (err?.code === '23505') {
      // Unique constraint violation
      res.status(409).json({ error: 'A site or cell with this name already exists.' });
      return;
    }
    if (err?.code === '23502') {
      // Not-null constraint violation
      res.status(400).json({ error: `Missing required database field: ${err?.column}` });
      return;
    }
    if (err?.code === '23514') {
      // Check constraint violation (e.g. technology enum)
      res.status(400).json({ error: `Value rejected by database constraint: ${err?.constraint}` });
      return;
    }

    res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
};

// ── PUT /api/network/sites/:id ─────────────────────────────
export const updateSiteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const siteId = parseInt(req.params.id as string);
    if (isNaN(siteId)) {
      res.status(400).json({ error: 'Invalid site id' });
      return;
    }

    const { site_name, region, address, longitude, latitude } = req.body;
    const updated = await updateSiteService({
      id: siteId,
      site_name,
      region,
      address,
      longitude: longitude != null ? Number(longitude) : undefined,
      latitude:  latitude  != null ? Number(latitude)  : undefined,
    });

    res.json({ message: 'Site updated', site: updated });
  } catch (err: any) {
    console.error('updateSite error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
};

// ── DELETE /api/network/sites/:id ──────────────────────────
export const deleteSiteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const siteId = parseInt(req.params.id as string);
    if (isNaN(siteId)) {
      res.status(400).json({ error: 'Invalid site id' });
      return;
    }

    const deleted = await deleteSiteService(siteId);
    res.json({ message: 'Site deleted', ...deleted });
  } catch (err: any) {
    console.error('deleteSite error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
};

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getNetworkStats();
    res.json(stats);
  } catch (err: any) {
    console.error('getStats error:', err);
    res.status(500).json({ error: 'Internal server error', detail: err?.message });
  }
};