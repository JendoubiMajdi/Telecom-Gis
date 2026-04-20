import api from './api';

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
  const res = await api.get('/network/stats');
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
  const res = await api.get('/network/sites', { params });
  return res.data;
};

export const fetchSiteDetail = async (id: number) => {
  const res = await api.get(`/network/sites/${id}`);
  return res.data;
};