import { Request, Response } from 'express';
import {
  getSitesGeoJSON,
  getSiteDetail,
  getNetworkStats,
  createSiteWithCell,
  updateSite as updateSiteService,
  deleteSite as deleteSiteService,
} from '../services/network.service';
import { logAudit } from '../services/audit.service';
import { notifyAdmins } from '../services/notification.service';
import { AuthRequest } from '../models/AuthRequest';

const actorOf = (req: Request): { id: string | undefined; name: string } => {
  const r = req as AuthRequest;
  return { id: r.userId, name: r.user?.email ?? 'An administrator' };
};

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

    await logAudit(req, {
      action: 'site.create',
      entityType: 'site',
      entityId: result.siteId,
      details: {
        site_name: String(site_name).trim(),
        region: region ? String(region).trim() : '',
        technology,
        cell_name: String(cell_name).trim(),
        longitude: lng,
        latitude: lat,
      },
    });

    const actor = actorOf(req);
    await notifyAdmins(
      {
        type: 'site.create',
        title: 'Site added',
        message: `${actor.name} added "${String(site_name).trim()}" (${technology}${region ? ', ' + String(region).trim() : ''})`,
        link: `/map?site=${result.siteId}`,
        entityType: 'site',
        entityId: result.siteId,
      },
      actor.id
    );

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

    if (longitude != null && (isNaN(Number(longitude)) || Math.abs(Number(longitude)) > 180)) {
      res.status(400).json({ error: 'longitude must be a number between -180 and 180' });
      return;
    }
    if (latitude != null && (isNaN(Number(latitude)) || Math.abs(Number(latitude)) > 90)) {
      res.status(400).json({ error: 'latitude must be a number between -90 and 90' });
      return;
    }

    // Snapshot before the change so the audit log can store before/after values.
    const before = await getSiteDetail(siteId);

    const updated = await updateSiteService({
      id: siteId,
      site_name,
      region,
      address,
      longitude: longitude != null ? Number(longitude) : undefined,
      latitude:  latitude  != null ? Number(latitude)  : undefined,
    });

    if (!updated) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    // Log only the fields that really changed.
    const fields = ['site_name', 'region', 'address', 'longitude', 'latitude'] as const;
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const f of fields) {
      const from = before?.[f];
      const to = updated[f];
      const same = (f === 'longitude' || f === 'latitude')
        ? Number(from) === Number(to)
        : (from ?? '') === (to ?? '');
      if (!same) changes[f] = { from: from ?? null, to: to ?? null };
    }
    await logAudit(req, {
      action: 'site.update',
      entityType: 'site',
      entityId: siteId,
      details: { site_name: updated.site_name, changes },
    });

    // Only notify when something really changed
    if (Object.keys(changes).length > 0) {
      const actor = actorOf(req);
      const parts: string[] = [];
      for (const [field, c] of Object.entries(changes)) {
        if (field === 'longitude' || field === 'latitude') {
          if (!parts.includes('location moved')) parts.push('location moved');
        } else {
          parts.push(`${field}: ${c.from ?? '∅'} → ${c.to ?? '∅'}`);
        }
      }
      await notifyAdmins(
        {
          type: 'site.update',
          title: 'Site updated',
          message: `${actor.name} edited "${updated.site_name}" — ${parts.join(', ')}`.slice(0, 220),
          link: `/map?site=${siteId}`,
          entityType: 'site',
          entityId: siteId,
        },
        actor.id
      );
    }

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

    // Snapshot before deletion so the log keeps what was removed.
    const before = await getSiteDetail(siteId);
    if (!before) {
      res.status(404).json({ error: 'Site not found' });
      return;
    }

    const deleted = await deleteSiteService(siteId);

    await logAudit(req, {
      action: 'site.delete',
      entityType: 'site',
      entityId: siteId,
      details: {
        site_name: before.site_name,
        region: before.region,
        cells_deleted: before.cells?.length ?? 0,
      },
    });

    const actor = actorOf(req);
    await notifyAdmins(
      {
        type: 'site.delete',
        title: 'Site deleted',
        message: `${actor.name} deleted "${before.site_name}" (${before.cells?.length ?? 0} cells removed)`,
        link: null,                       // the site no longer exists
        entityType: 'site',
        entityId: siteId,
      },
      actor.id
    );

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