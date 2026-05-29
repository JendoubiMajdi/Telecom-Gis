import api from './api';

// ── Standard types ─────────────────────────────────────────────────────────────
export interface NetworkStats {
  technology: string;
  cell_count: string;
  site_count: string;
}

export interface SiteFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: number;
    site_name: string;
    region: string;
    technologies: string[];
    cell_count: number;
  };
}

export interface SitesGeoJSON {
  type: 'FeatureCollection';
  features: SiteFeature[];
}

export interface SiteCell {
  id: number;
  technology: string;
  cell_name: string;
  cell_index: number;
  azimuth: number;
  activity_status: string;
}

export interface SiteDetail {
  id: number;
  site_name: string;
  region: string;
  address: string;
  longitude: number;
  latitude: number;
  geometry: { type: 'Point'; coordinates: [number, number] };
  cells: SiteCell[];
}

export interface UpdateSitePayload {
  site_name?: string;
  region?: string;
  address?: string;
  longitude?: number;
  latitude?: number;
}

export interface NewSiteFormValues {
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

// ── AI types ───────────────────────────────────────────────────────────────────
export interface GapZone {
  lat: number;
  lng: number;
  gridSizeDeg: number;
  nearestSiteKm: number;
  region: string;
}

export interface CoverageGapsResponse {
  count: number;
  gaps: GapZone[];
}

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

export interface UpgradeRecommendationResponse {
  recommendation: string;
  analysisData: SiteAnalysisData;
}

// ── Standard API calls ─────────────────────────────────────────────────────────
export const fetchNetworkStats = async (): Promise<NetworkStats[]> => {
  const res = await api.get('/network/stats');
  return res.data;
};

export const fetchSites = async (
  bbox: [number, number, number, number],
  technology?: string
): Promise<SitesGeoJSON> => {
  const params: Record<string, string> = { bbox: bbox.join(',') };
  if (technology) params.technology = technology;
  const res = await api.get('/network/sites', { params });
  return res.data;
};

export const fetchSiteDetail = async (id: number): Promise<SiteDetail> => {
  const res = await api.get(`/network/sites/${id}`);
  return res.data;
};

export const updateSite = async (id: number, payload: UpdateSitePayload) => {
  const res = await api.put(`/network/sites/${id}`, payload);
  return res.data;
};

export const deleteSite = async (id: number) => {
  const res = await api.delete(`/network/sites/${id}`);
  return res.data;
};

export const createSite = async (payload: NewSiteFormValues) => {
  const res = await api.post('/network/sites', payload);
  return res.data;
};

// ── AI API calls ───────────────────────────────────────────────────────────────
export const fetchCoverageGaps = async (
  gridStep = 0.15,
  minGapKm = 8
): Promise<CoverageGapsResponse> => {
  const res = await api.get('/ai/coverage-gaps', { params: { gridStep, minGapKm } });
  return res.data;
};

export const fetchSiteAnalysis = async (siteId: number): Promise<SiteAnalysisData> => {
  const res = await api.get(`/ai/site-analysis/${siteId}`);
  return res.data;
};

// Calls Claude via YOUR backend — API key stays in .env, never in the browser
export const fetchUpgradeRecommendation = async (
  siteId: number
): Promise<UpgradeRecommendationResponse> => {
  const res = await api.post('/ai/upgrade-recommendation', { siteId });
  return res.data;
};

// ── POI Coverage ───────────────────────────────────────────────────────────────
export type PoiCategory = 'hospital' | 'school' | 'ministry';

export interface RawPoi {
  id: number;
  lat: number;
  lng: number;
  name: string;
  subtype: string;
  category: PoiCategory;
}

export interface PoiResult {
  id: number;
  name: string;
  lat: number;
  lng: number;
  category: PoiCategory;
  subtype: string;
  covered: boolean;
  nearestSiteKm: number | null;
  nearestSiteName: string | null;
}

export interface PoiAnalysisResult {
  total: number;
  uncovered: number;
  covered: number;
  coveragePercent: number;
  pois: PoiResult[];
}

// Tunisia bounding box: south,west,north,east
const TN_BBOX = '30.2,7.5,37.6,11.6';

const OVERPASS_QUERIES: Record<PoiCategory, string> = {
  hospital: `[out:json][timeout:60];(node["amenity"="hospital"](${TN_BBOX});node["amenity"="clinic"](${TN_BBOX});node["healthcare"="hospital"](${TN_BBOX});way["amenity"="hospital"](${TN_BBOX});way["healthcare"="hospital"](${TN_BBOX}););out center;`,
  school:   `[out:json][timeout:60];(node["amenity"="school"](${TN_BBOX});node["amenity"="college"](${TN_BBOX});node["amenity"="university"](${TN_BBOX});way["amenity"="school"](${TN_BBOX});way["amenity"="college"](${TN_BBOX});way["amenity"="university"](${TN_BBOX}););out center;`,
  ministry: `[out:json][timeout:60];(node["office"="government"](${TN_BBOX});node["amenity"="townhall"](${TN_BBOX});node["government"="ministry"](${TN_BBOX});way["office"="government"](${TN_BBOX});way["amenity"="townhall"](${TN_BBOX}););out center;`,
};

// Called from browser — Overpass accepts browser requests fine
async function fetchOverpassPois(category: PoiCategory): Promise<RawPoi[]> {
  const query = OVERPASS_QUERIES[category];
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!response.ok) throw new Error(`Overpass error ${response.status}`);

  const json = await response.json() as {
    elements: Array<{
      id: number; type: string;
      lat?: number; lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };

  return json.elements
    .map(el => {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (!lat || !lon) return null;
      if (lat < 30.2 || lat > 37.6 || lon < 7.5 || lon > 11.6) return null;
      const tags = el.tags ?? {};
      return {
        id: el.id,
        lat, lng: lon,
        name: tags['name:fr'] || tags['name:en'] || tags['name'] || 'Sans nom',
        subtype: tags['amenity'] || tags['office'] || tags['healthcare'] || category,
        category,
      } as RawPoi;
    })
    .filter((x): x is RawPoi => x !== null);
}

// Main function: fetch from Overpass (browser), check coverage via backend (PostGIS)
export const fetchPoiCoverage = async (
  categories: PoiCategory[],
  radiusKm: number
): Promise<PoiAnalysisResult> => {

  // Step 1: fetch all POIs from Overpass in browser
  const fetched = await Promise.all(categories.map(fetchOverpassPois));
  const allRaw: RawPoi[] = fetched.flat();

  if (allRaw.length === 0) {
    return { total: 0, uncovered: 0, covered: 0, coveragePercent: 0, pois: [] };
  }

  // Step 2: send to backend in chunks of 500 to avoid 413 Payload Too Large
  const CHUNK_SIZE = 500;
  const allResults: any[] = [];
  for (let i = 0; i < allRaw.length; i += CHUNK_SIZE) {
    const chunk = allRaw.slice(i, i + CHUNK_SIZE);
    const res = await api.post('/poi/check', { pois: chunk, radiusKm });
    allResults.push(...res.data);
  }
  const coverageMap = new Map<number, { covered: boolean; nearestSiteKm: number; nearestSiteName: string }>();
  for (const r of allResults) coverageMap.set(r.id, r);

  // Step 3: merge
  const pois: PoiResult[] = allRaw.map(raw => {
    const c = coverageMap.get(raw.id);
    return {
      id: raw.id, name: raw.name, lat: raw.lat, lng: raw.lng,
      category: raw.category, subtype: raw.subtype,
      covered: c?.covered ?? false,
      nearestSiteKm: c?.nearestSiteKm ?? null,
      nearestSiteName: c?.nearestSiteName ?? null,
    };
  });

  const uncovered = pois.filter(p => !p.covered).length;
  return {
    total: pois.length, uncovered,
    covered: pois.length - uncovered,
    coveragePercent: Math.round(((pois.length - uncovered) / pois.length) * 100),
    pois,
  };
};