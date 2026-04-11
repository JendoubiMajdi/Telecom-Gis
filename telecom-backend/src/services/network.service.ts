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

// ── Single site detail with all its cells ─────────────────
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