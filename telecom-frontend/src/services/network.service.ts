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
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  cells: SiteCell[];
}

export interface UpdateSitePayload {
  site_name?: string;
  region?: string;
  address?: string;
  longitude?: number;
  latitude?: number;
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