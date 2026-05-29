import pool from '../db/database';

// ── IDEA 2: Coverage Gap Predictor ─────────────────────────────────────────────
export interface GapZone {
  lat: number;
  lng: number;
  gridSizeDeg: number;
  nearestSiteKm: number;
  region: string;
}

export const getCoverageGaps = async (
  gridStepDeg = 0.15,
  minGapKm = 8
): Promise<GapZone[]> => {
  const LAT_MIN = 30.2, LAT_MAX = 37.6;
  const LNG_MIN = 7.5,  LNG_MAX = 11.6;

  // FIXED QUERY:
  // The previous version had a correlated subquery bug where
  // (SELECT ... ORDER BY g.pt <-> s.location LIMIT 1) was not
  // correctly correlating per grid point in all PG versions.
  //
  // This version uses LATERAL JOIN which is the correct way:
  // For each grid point, LATERAL executes the inner query with
  // access to the outer row (g.pt), finding the true nearest site.
  const result = await pool.query(
    `
    WITH grid AS (
      SELECT
        lat_center,
        lng_center,
        ST_SetSRID(ST_MakePoint(lng_center, lat_center), 4326) AS pt
      FROM
        generate_series($1::numeric, $2::numeric, $3::numeric) AS lat_center,
        generate_series($4::numeric, $5::numeric, $3::numeric) AS lng_center
    )
    SELECT
      g.lat_center  AS lat,
      g.lng_center  AS lng,
      nearest.dist_km
    FROM grid g
    -- LATERAL: for each grid point, find the single nearest site correctly
    CROSS JOIN LATERAL (
      SELECT
        ST_Distance(g.pt::geography, s.location::geography) / 1000.0 AS dist_km
      FROM sites s
      ORDER BY g.pt <-> s.location   -- uses spatial index efficiently
      LIMIT 1
    ) nearest
    WHERE nearest.dist_km > $6
    -- Return ALL gaps, not just the biggest ones, so orange/yellow zones are included.
    -- Frontend will group and display them properly.
    ORDER BY nearest.dist_km DESC
    LIMIT 2000
    `,
    [LAT_MIN, LAT_MAX, gridStepDeg, LNG_MIN, LNG_MAX, minGapKm]
  );

  const getRegion = (lat: number, lng: number): string => {
    if (lat > 36.5) return 'North (Bizerte/Tunis)';
    if (lat > 35.5 && lng < 9.0) return 'Northwest (Jendouba/Béja)';
    if (lat > 35.5) return 'Northeast (Nabeul/Sousse)';
    if (lat > 34.5 && lng < 9.5) return 'Center-West (Kasserine/Sidi Bouzid)';
    if (lat > 34.5) return 'Center-East (Sfax/Mahdia)';
    if (lat > 33.0 && lng < 9.0) return 'Southwest (Gafsa/Tozeur)';
    if (lat > 33.0) return 'South-East (Gabès/Médenine)';
    return 'Deep South (Tataouine/Kébili)';
  };

  return result.rows.map(row => ({
    lat:           parseFloat(row.lat),
    lng:           parseFloat(row.lng),
    gridSizeDeg:   gridStepDeg / 2,
    nearestSiteKm: parseFloat(row.dist_km),
    region:        getRegion(parseFloat(row.lat), parseFloat(row.lng)),
  }));
};


// ── IDEA 4: Site Analysis Data ─────────────────────────────────────────────────
export interface SiteAnalysisData {
  site: {
    id: number;
    site_name: string;
    region: string;
    latitude: number;
    longitude: number;
    cell_count: number;
    technologies: string[];
    active_cells: number;
    inactive_cells: number;
    azimuths: number[];
  };
  neighbors: Array<{
    site_name: string;
    distance_km: number;
    technologies: string[];
    cell_count: number;
  }>;
  regionStats: {
    region: string;
    total_sites: number;
    sites_with_4g: number;
    sites_with_5g: number;
    avg_cells_per_site: number;
  };
}

export const getSiteAnalysisData = async (siteId: number): Promise<SiteAnalysisData | null> => {
  const siteResult = await pool.query(
    `
    SELECT
      s.id, s.site_name, s.region, s.latitude, s.longitude,
      array_agg(DISTINCT c.technology ORDER BY c.technology) AS technologies,
      COUNT(c.id) AS cell_count,
      COUNT(c.id) FILTER (WHERE c.activity_status = 'active') AS active_cells,
      COUNT(c.id) FILTER (WHERE c.activity_status != 'active') AS inactive_cells,
      array_agg(c.azimuth ORDER BY c.azimuth) AS azimuths
    FROM sites s
    JOIN cells c ON c.site_id = s.id
    WHERE s.id = $1
    GROUP BY s.id, s.site_name, s.region, s.latitude, s.longitude
    `,
    [siteId]
  );

  if (siteResult.rows.length === 0) return null;
  const site = siteResult.rows[0];

  const neighborResult = await pool.query(
    `
    SELECT
      s.site_name,
      ST_Distance(s.location::geography,
        (SELECT location::geography FROM sites WHERE id = $1)
      ) / 1000.0 AS distance_km,
      array_agg(DISTINCT c.technology ORDER BY c.technology) AS technologies,
      COUNT(c.id) AS cell_count
    FROM sites s
    JOIN cells c ON c.site_id = s.id
    WHERE s.id != $1
      AND ST_DWithin(
        s.location::geography,
        (SELECT location::geography FROM sites WHERE id = $1),
        15000
      )
    GROUP BY s.id, s.site_name, s.location
    ORDER BY distance_km
    LIMIT 10
    `,
    [siteId]
  );

  const regionResult = await pool.query(
    `
    SELECT
      COUNT(DISTINCT s.id) AS total_sites,
      COUNT(DISTINCT s.id) FILTER (
        WHERE EXISTS (SELECT 1 FROM cells c2 WHERE c2.site_id = s.id AND c2.technology = '4G')
      ) AS sites_with_4g,
      COUNT(DISTINCT s.id) FILTER (
        WHERE EXISTS (SELECT 1 FROM cells c2 WHERE c2.site_id = s.id AND c2.technology IN ('5G','5G_FDD','5G_TDD'))
      ) AS sites_with_5g,
      ROUND(AVG(cell_counts.cnt), 1) AS avg_cells_per_site
    FROM sites s
    JOIN (
      SELECT site_id, COUNT(*) AS cnt FROM cells GROUP BY site_id
    ) cell_counts ON cell_counts.site_id = s.id
    WHERE s.region = $1
    `,
    [site.region]
  );

  const rs = regionResult.rows[0];

  return {
    site: {
      id:             site.id,
      site_name:      site.site_name,
      region:         site.region,
      latitude:       parseFloat(site.latitude),
      longitude:      parseFloat(site.longitude),
      cell_count:     parseInt(site.cell_count),
      technologies:   site.technologies,
      active_cells:   parseInt(site.active_cells),
      inactive_cells: parseInt(site.inactive_cells),
      azimuths:       site.azimuths,
    },
    neighbors: neighborResult.rows.map(n => ({
      site_name:    n.site_name,
      distance_km:  parseFloat(parseFloat(n.distance_km).toFixed(2)),
      technologies: n.technologies,
      cell_count:   parseInt(n.cell_count),
    })),
    regionStats: {
      region:             site.region,
      total_sites:        parseInt(rs.total_sites),
      sites_with_4g:      parseInt(rs.sites_with_4g),
      sites_with_5g:      parseInt(rs.sites_with_5g),
      avg_cells_per_site: parseFloat(rs.avg_cells_per_site),
    },
  };
};


// ── Claude API call — server-side, key never exposed to browser ────────────────
export const getUpgradeRecommendation = async (
  siteId: number
): Promise<{ recommendation: string; analysisData: SiteAnalysisData }> => {

  const analysisData = await getSiteAnalysisData(siteId);
  if (!analysisData) throw new Error('Site not found');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set in .env');

  const { site, neighbors, regionStats } = analysisData;
  const total = regionStats.total_sites || 1;

  const prompt = `You are an expert telecom network engineer analyzing a cell tower site in Tunisia.

SITE: ${site.site_name}
- Region: ${site.region}
- Technologies: ${site.technologies.join(', ')}
- Total cells: ${site.cell_count} (${site.active_cells} active, ${site.inactive_cells} inactive)
- Azimuths: ${site.azimuths.join('°, ')}°

NEARBY SITES within 15 km:
${neighbors.length === 0
    ? '- None (isolated site — no neighbors detected)'
    : neighbors.map(n =>
        `- ${n.site_name} @ ${n.distance_km} km — [${n.technologies.join('/')}] — ${n.cell_count} cells`
      ).join('\n')}

REGION (${regionStats.region}):
- ${regionStats.total_sites} total sites
- 4G adoption: ${Math.round(regionStats.sites_with_4g / total * 100)}% of sites
- 5G adoption: ${Math.round(regionStats.sites_with_5g / total * 100)}% of sites
- Avg cells/site: ${regionStats.avg_cells_per_site}

Provide a structured upgrade recommendation using exactly these sections:

**Upgrade Priority**: [Critical / High / Medium / Low / Not Needed]

**Recommended Actions**:
- [action 1]
- [action 2]
- [action 3 if needed]

**Reasoning**: [2-3 sentences]

**Risk if not upgraded**: [1 sentence]

Be concise and practical. No intro or conclusion outside these sections.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const json = await response.json() as {
    content: Array<{ type: string; text?: string }>;
  };

  const recommendation = json.content
    .filter(b => b.type === 'text')
    .map(b => b.text ?? '')
    .join('');

  return { recommendation, analysisData };
};