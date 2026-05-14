import pool from '../db/database';

export interface BboxParams {
  lng1: number;
  lat1: number;
  lng2: number;
  lat2: number;
}

export interface SitesQueryParams extends BboxParams {
  technology?: string;
}

// ── Sites as GeoJSON FeatureCollection ────────────────────
export const getSitesGeoJSON = async ({ lng1, lat1, lng2, lat2, technology }: SitesQueryParams) => {
  const result = await pool.query(
    `
    SELECT
      s.id,
      s.site_name,
      s.region,
      ST_AsGeoJSON(s.location)::json AS geometry,
      array_agg(DISTINCT c.technology ORDER BY c.technology) AS technologies,
      COUNT(c.id) AS cell_count
    FROM sites s
    JOIN cells c ON c.site_id = s.id
    WHERE s.location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
      AND ($5::text IS NULL OR c.technology = $5)
    GROUP BY s.id, s.site_name, s.region, s.location
    LIMIT 5000
    `,
    [lng1, lat1, lng2, lat2, technology || null]
  );

  return {
    type: 'FeatureCollection',
    features: result.rows.map((row) => ({
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        id: row.id,
        site_name: row.site_name,
        region: row.region,
        technologies: row.technologies,
        cell_count: parseInt(row.cell_count),
      },
    })),
  };
};

export const getSiteDetail = async (siteId: number) => {
  const siteResult = await pool.query(
    `
    SELECT
      s.id,
      s.site_name,
      s.longitude,
      s.latitude,
      s.address,
      s.region,
      ST_AsGeoJSON(s.location)::json AS geometry
    FROM sites s
    WHERE s.id = $1
    `,
    [siteId]
  );

  if (siteResult.rows.length === 0) return null;

  const cellsResult = await pool.query(
    `
    SELECT
      c.id,
      c.technology,
      c.cell_name,
      c.cell_index,
      c.azimuth,
      c.activity_status
    FROM cells c
    WHERE c.site_id = $1
    ORDER BY c.technology, c.cell_name
    `,
    [siteId]
  );

  return {
    ...siteResult.rows[0],
    cells: cellsResult.rows,
  };
};

// ── Stats: count per technology ────────────────────────────
export const getNetworkStats = async () => {
  const result = await pool.query(
    `
    SELECT
      c.technology,
      COUNT(DISTINCT c.id)      AS cell_count,
      COUNT(DISTINCT c.site_id) AS site_count
    FROM cells c
    GROUP BY c.technology
    ORDER BY c.technology
    `
  );

  return result.rows;
};

export interface NewSiteWithCellParams {
  site_name: string;
  region: string;
  address: string;
  longitude: number;
  latitude: number;
  technology: string;
  cell_name: string;
  cell_index: number;
  azimuth: number;
  activity_status: string;
}

export const createSiteWithCell = async (params: NewSiteWithCellParams) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── FIX: pass longitude and latitude as separate $6 and $7 parameters
    // so PostgreSQL can unambiguously type them as float8 for ST_MakePoint,
    // while $4 and $5 remain typed as the numeric columns they map to.
    const insertSite = await client.query(
      `
      INSERT INTO sites (site_name, region, address, longitude, latitude, location)
      VALUES (
        $1,
        $2,
        $3,
        $4::float8,
        $5::float8,
        ST_SetSRID(ST_MakePoint($6::float8, $7::float8), 4326)
      )
      RETURNING id
      `,
      [
        params.site_name,
        params.region,
        params.address,
        params.longitude,
        params.latitude,
        params.longitude,   // $6 — dedicated param for ST_MakePoint x (longitude)
        params.latitude,    // $7 — dedicated param for ST_MakePoint y (latitude)
      ]
    );

    const siteId = insertSite.rows[0].id;

    const insertCell = await client.query(
      `
      INSERT INTO cells (site_id, technology, cell_name, cell_index, azimuth, activity_status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [
        siteId,
        params.technology,
        params.cell_name,
        params.cell_index,
        params.azimuth,
        params.activity_status,
      ]
    );

    await client.query('COMMIT');

    return {
      siteId,
      cellId: insertCell.rows[0].id,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export interface UpdateSiteParams {
  id: number;
  site_name?: string;
  region?: string;
  address?: string;
  longitude?: number;
  latitude?: number;
}

export const updateSite = async (params: UpdateSiteParams) => {
  const fields: string[] = [];
  const values: Array<string | number> = [];

  if (params.site_name !== undefined) {
    fields.push('site_name = $' + (fields.length + 1));
    values.push(params.site_name);
  }
  if (params.region !== undefined) {
    fields.push('region = $' + (fields.length + 1));
    values.push(params.region);
  }
  if (params.address !== undefined) {
    fields.push('address = $' + (fields.length + 1));
    values.push(params.address);
  }
  if (params.longitude !== undefined) {
    fields.push('longitude = $' + (fields.length + 1));
    values.push(params.longitude);
  }
  if (params.latitude !== undefined) {
    fields.push('latitude = $' + (fields.length + 1));
    values.push(params.latitude);
  }

  if (fields.length === 0) {
    throw new Error('No site fields provided to update');
  }

  // If coordinates changed, also update the PostGIS location column
  if (params.longitude !== undefined || params.latitude !== undefined) {
    fields.push(
      `location = ST_SetSRID(ST_MakePoint(
        COALESCE($${values.indexOf(params.longitude!) + 1}, longitude),
        COALESCE($${values.indexOf(params.latitude!) + 1}, latitude)
      ), 4326)`
    );
  }

  values.push(params.id);
  const query = `UPDATE sites SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0];
};

export const deleteSite = async (siteId: number) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM cells WHERE site_id = $1', [siteId]);
    const result = await client.query('DELETE FROM sites WHERE id = $1 RETURNING id', [siteId]);
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};