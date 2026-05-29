import pool from '../db/database';

export type PoiCategory = 'hospital' | 'school' | 'ministry';

export interface PoiPoint {
  id: number;
  lat: number;
  lng: number;
  name: string;
  subtype: string;
  category: PoiCategory;
}

export interface PoiCoverageCheckResult {
  id: number;
  lat: number;
  lng: number;
  covered: boolean;
  nearestSiteKm: number | null;
  nearestSiteName: string | null;
}

export const checkPoiCoverage = async (
  pois: PoiPoint[],
  radiusKm: number
): Promise<PoiCoverageCheckResult[]> => {

  if (pois.length === 0) return [];

  // Use bigint instead of int — OSM IDs exceed PostgreSQL integer range (max ~2.1B)
  const valuesList = pois
    .map((_, i) => `($${i * 3 + 1}::bigint, $${i * 3 + 2}::float, $${i * 3 + 3}::float)`)
    .join(', ');

  const params: (number | string)[] = pois.flatMap(p => [String(p.id), p.lng, p.lat]);

  const result = await pool.query(
    `
    WITH pois(osm_id, lng, lat) AS (VALUES ${valuesList})
    SELECT
      p.osm_id,
      p.lat,
      p.lng,
      nearest.dist_km,
      nearest.site_name
    FROM pois p
    CROSS JOIN LATERAL (
      SELECT
        ST_Distance(
          ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326)::geography,
          s.location::geography
        ) / 1000.0 AS dist_km,
        s.site_name
      FROM sites s
      ORDER BY ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326) <-> s.location
      LIMIT 1
    ) nearest
    `,
    params
  );

  return result.rows.map(row => ({
    id:              Number(row.osm_id),
    lat:             parseFloat(row.lat),
    lng:             parseFloat(row.lng),
    covered:         parseFloat(row.dist_km) <= radiusKm,
    nearestSiteKm:   parseFloat(parseFloat(row.dist_km).toFixed(2)),
    nearestSiteName: row.site_name,
  }));
};