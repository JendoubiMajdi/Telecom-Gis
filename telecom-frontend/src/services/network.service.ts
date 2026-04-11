import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export interface NetworkStats {
  technology: string;
  cell_count: string;
  site_count: string;
}

export interface SiteFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
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

export const fetchNetworkStats = async (): Promise<NetworkStats[]> => {
  const res = await axios.get(`${API_BASE}/network/stats`);
  return res.data;
};

export const fetchSites = async (
  bbox: [number, number, number, number],
  technology?: string
): Promise<SitesGeoJSON> => {
  const params: Record<string, string> = {
    bbox: bbox.join(','),
  };
  if (technology) params.technology = technology;
  const res = await axios.get(`${API_BASE}/network/sites`, { params });
  return res.data;
};

export const fetchSiteDetail = async (id: number) => {
  const res = await axios.get(`${API_BASE}/network/sites/${id}`);
  return res.data;
};