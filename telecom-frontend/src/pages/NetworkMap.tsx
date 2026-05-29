import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Popup,
  Tooltip,
  Circle,
  useMapEvents,
  useMap,
  Marker,
} from 'react-leaflet';
import L, { LatLngBounds } from 'leaflet';
import styles from './NetworkMap.module.css';
import {
  fetchSites,
  fetchNetworkStats,
  NetworkStats,
  SiteFeature,
  SiteDetail,
  SiteAnalysisData,
  GapZone,
  createSite,
  updateSite,
  deleteSite,
  fetchSiteDetail,
  fetchCoverageGaps,
  fetchUpgradeRecommendation,
  NewSiteFormValues,
  UpdateSitePayload,
  fetchPoiCoverage,
  PoiResult,
  PoiCategory,
  PoiAnalysisResult,
} from '../services/network.service';

const TECHNOLOGIES = ['2G', '3G', '4G', '5G', '5G_FDD', '5G_TDD'] as const;

const TECH_COLORS: Record<string, string> = {
  '2G': '#22c55e', '3G': '#f97316', '4G': '#3b82f6',
  '5G': '#a855f7', '5G_FDD': '#ec4899', '5G_TDD': '#06b6d4',
};

const TECH_CLASS: Record<string, string> = {
  '2G': 'tech2g', '3G': 'tech3g', '4G': 'tech4g',
  '5G': 'tech5g', '5G_FDD': 'tech5gfdd', '5G_TDD': 'tech5gtdd',
};

const TECH_LABELS: Record<string, string> = {
  '2G': '2G GSM', '3G': '3G UMTS', '4G': '4G LTE',
  '5G': '5G NR', '5G_FDD': '5G FDD', '5G_TDD': '5G TDD',
};

// ── POI config ────────────────────────────────────────────────────────────────
const POI_CONFIG: Record<string, { color: string; uncoveredColor: string; emoji: string; label: string }> = {
  hospital:  { color: '#10b981', uncoveredColor: '#ef4444', emoji: '🏥', label: 'Hôpital / Clinique' },
  school:    { color: '#3b82f6', uncoveredColor: '#f97316', emoji: '🏫', label: 'École / Université' },
  ministry:  { color: '#8b5cf6', uncoveredColor: '#ec4899', emoji: '🏛', label: 'Ministère / Mairie' },
};

function makePoiIcon(emoji: string, color: string, covered: boolean): L.DivIcon {
  const bg = covered ? color + '22' : color + '33';
  const border = covered ? color + '88' : color;
  const size = covered ? 28 : 34;
  const svg = `<div style="
    width:${size}px;height:${size}px;border-radius:50%;
    background:${bg};border:2px solid ${border};
    display:flex;align-items:center;justify-content:center;
    font-size:${covered ? 13 : 16}px;
    box-shadow:0 2px 8px rgba(0,0,0,0.3);
    opacity:${covered ? 0.5 : 1};
  ">${emoji}</div>`;
  return L.divIcon({ html: svg, className: '', iconSize: [size, size], iconAnchor: [size/2, size/2], popupAnchor: [0, -size/2] });
}

const BASE_RADIUS: Record<string, number> = {
  '2G': 8000, '3G': 5000, '4G': 3000, '5G': 1200, '5G_FDD': 1500, '5G_TDD': 900,
};

// ── Icon factories ─────────────────────────────────────────────────────────────
function makeTowerIcon(color: string, size = 34): L.DivIcon {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 6}" viewBox="0 0 34 40">
    <defs><filter id="sh" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/>
    </filter></defs>
    <circle cx="17" cy="17" r="16" fill="${color}" opacity="0.18" filter="url(#sh)"/>
    <circle cx="17" cy="17" r="13" fill="white" stroke="${color}" stroke-width="2"/>
    <line x1="17" y1="8" x2="17" y2="26" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <line x1="12" y1="14" x2="22" y2="14" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="13" y1="19" x2="21" y2="19" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="17" y1="26" x2="12" y2="30" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="17" y1="26" x2="22" y2="30" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
    <line x1="13" y1="8" x2="21" y2="8" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
    <polygon points="17,40 13,32 21,32" fill="${color}" opacity="0.85"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [size, size + 6], iconAnchor: [size / 2, size + 6], popupAnchor: [0, -(size + 6)] });
}

function makeClusterIcon(color: string, count: number): L.DivIcon {
  const r = Math.min(18 + count * 0.8, 34);
  const total = r * 2 + 8;
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}">
    <circle cx="${r + 4}" cy="${r + 4}" r="${r + 2}" fill="${color}" opacity="0.18"/>
    <circle cx="${r + 4}" cy="${r + 4}" r="${r}" fill="${color}" opacity="0.72" stroke="white" stroke-width="2"/>
    <text x="${r + 4}" y="${r + 9}" text-anchor="middle" font-size="${r < 22 ? 11 : 13}" font-weight="700" font-family="monospace" fill="white">${count}</text>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [total, total], iconAnchor: [total / 2, total / 2], popupAnchor: [0, -total / 2] });
}

function getCoverageRadius(site: SiteFeature, activeTech: string | null): number {
  const t = activeTech || site.properties.technologies?.[0] || '2G';
  return Math.round((BASE_RADIUS[t] ?? 3000) * (1 + Math.min(site.properties.cell_count - 1, 4) * 0.10));
}

function gapStyle(km: number): { color: string; fillOpacity: number; weight: number; radius: number } {
  const radius = Math.min(km * 380, 18000);
  if (km > 40) return { color: '#ff1744', fillOpacity: 0.38, weight: 1.5, radius };
  if (km > 20) return { color: '#ff6d00', fillOpacity: 0.42, weight: 1.5, radius };
  return               { color: '#ffd600', fillOpacity: 0.48, weight: 1.2, radius };
}

// ── Map plumbing ───────────────────────────────────────────────────────────────
const TUNISIA_CENTER: [number, number] = [33.5, 9.2];
const TUNISIA_BOUNDS: [[number, number], [number, number]] = [[29.5, 7.5], [38.0, 11.8]];

function MapEventHandler({ activeTech, onSitesLoaded, onLoadingChange, onZoomChange, reloadSignal }: {
  activeTech: string | null;
  onSitesLoaded: (f: SiteFeature[]) => void;
  onLoadingChange: (v: boolean) => void;
  onZoomChange: (z: number) => void;
  reloadSignal: number;
}) {
  const loadingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, { data: SiteFeature[]; ts: number }>>(new Map());

  const getCacheKey = useCallback((bounds: LatLngBounds, tech: string | null) => {
    const b = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
      .map(v => Math.round(v * 100) / 100).join(',');
    return `${b}-${tech || 'all'}`;
  }, []);

  const load = useCallback(async (bounds: LatLngBounds, force = false) => {
    if (loadingRef.current && !force) return;
    const key = getCacheKey(bounds, activeTech);
    const cached = cacheRef.current.get(key);
    if (cached && Date.now() - cached.ts < 5 * 60_000 && !force) { onSitesLoaded(cached.data); return; }
    loadingRef.current = true;
    onLoadingChange(true);
    try {
      const bbox: [number, number, number, number] = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      const data = activeTech ? await fetchSites(bbox, activeTech) : await fetchSites(bbox);
      cacheRef.current.set(key, { data: data.features, ts: Date.now() });
      if (cacheRef.current.size > 20) cacheRef.current.delete(cacheRef.current.keys().next().value!);
      onSitesLoaded(data.features);
    } catch (err) { console.error('Failed to load sites:', err); }
    finally { loadingRef.current = false; onLoadingChange(false); }
  }, [activeTech, onSitesLoaded, onLoadingChange, getCacheKey]);

  const debouncedLoad = useCallback((bounds: LatLngBounds) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(bounds), 300);
  }, [load]);

  const map = useMapEvents({
    moveend: () => { debouncedLoad(map.getBounds()); onZoomChange(map.getZoom()); },
    zoomend: () => { debouncedLoad(map.getBounds()); onZoomChange(map.getZoom()); },
  });

  useEffect(() => { onZoomChange(map.getZoom()); load(map.getBounds(), true); }, [activeTech, reloadSignal]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
  return null;
}

function MapResizeObserver() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    const h = () => map.invalidateSize();
    window.addEventListener('resize', h);
    return () => { clearTimeout(t); window.removeEventListener('resize', h); };
  }, [map]);
  return null;
}

// ── AI Upgrade Recommendation Panel ───────────────────────────────────────────
// All Claude logic runs on the backend — this component just displays the result.
interface UpgradePanelProps {
  siteId: number;
  siteName: string;
  onClose: () => void;
}

const UpgradePanel: React.FC<UpgradePanelProps> = ({ siteId, siteName, onClose }) => {
  const [recommendation, setRecommendation] = useState('');
  const [analysisData, setAnalysisData] = useState<SiteAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchUpgradeRecommendation(siteId)
      .then(res => {
        setRecommendation(res.recommendation);
        setAnalysisData(res.analysisData);
      })
      .catch(err => {
        const msg = err?.response?.data?.error || err?.message || 'Unknown error';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [siteId]);

  // Simple markdown bold renderer
  const renderText = (text: string) =>
    text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} style={{ margin: '4px 0', lineHeight: 1.6 }}>
          {parts.map((part, j) =>
            j % 2 === 1
              ? <strong key={j} style={{ color: '#e2e8f0' }}>{part}</strong>
              : <span key={j}>{part}</span>
          )}
        </p>
      );
    });

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: '340px',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      borderLeft: '1px solid rgba(139,92,246,0.3)',
      display: 'flex', flexDirection: 'column', zIndex: 1000,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid rgba(139,92,246,0.2)',
        background: 'rgba(139,92,246,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#a78bfa', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
            🤖 AI Analysis
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Upgrade Recommendation</div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6,
          color: '#94a3b8', cursor: 'pointer', padding: '4px 10px', fontSize: 16,
        }}>×</button>
      </div>

      {/* Site name */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>📡 {siteName}</div>
        {analysisData && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {analysisData.site.technologies.map(t => (
                <span key={t} style={{
                  background: TECH_COLORS[t] + '33', color: TECH_COLORS[t],
                  border: `1px solid ${TECH_COLORS[t]}66`,
                  borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                }}>{t}</span>
              ))}
              <span style={{ color: '#64748b', fontSize: 11, padding: '2px 0' }}>
                · {analysisData.site.cell_count} cells · {analysisData.site.region}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>
                <span style={{ color: '#22c55e', fontWeight: 700 }}>●</span> {analysisData.site.active_cells} active
              </span>
              {analysisData.site.inactive_cells > 0 && (
                <span style={{ fontSize: 11, color: '#94a3b8' }}>
                  <span style={{ color: '#ef4444', fontWeight: 700 }}>●</span> {analysisData.site.inactive_cells} inactive
                </span>
              )}
              <span style={{ fontSize: 11, color: '#94a3b8' }}>👥 {analysisData.neighbors.length} neighbors</span>
            </div>
          </>
        )}
      </div>

      {/* Region stats */}
      {analysisData && (
        <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Region · {analysisData.regionStats.region}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Total Sites', value: analysisData.regionStats.total_sites },
              { label: 'Avg Cells/Site', value: analysisData.regionStats.avg_cells_per_site },
              { label: '4G Coverage', value: `${Math.round(analysisData.regionStats.sites_with_4g / (analysisData.regionStats.total_sites || 1) * 100)}%` },
              { label: '5G Coverage', value: `${Math.round(analysisData.regionStats.sites_with_5g / (analysisData.regionStats.total_sites || 1) * 100)}%` },
            ].map(item => (
              <div key={item.label} style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '6px 10px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Recommendation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
          AI Recommendation
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: 32, height: 32, border: '3px solid rgba(139,92,246,0.2)',
              borderTop: '3px solid #a78bfa', borderRadius: '50%',
              animation: 'spin 1s linear infinite', margin: '0 auto 12px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ color: '#64748b', fontSize: 13 }}>Analyzing network data…</div>
          </div>
        ) : error ? (
          <div style={{
            color: '#f87171', fontSize: 13, padding: '12px',
            background: 'rgba(239,68,68,0.1)', borderRadius: 8,
            border: '1px solid rgba(239,68,68,0.2)',
          }}>
            ⚠ {error}
            {error.includes('ANTHROPIC_API_KEY') && (
              <p style={{ marginTop: 8, fontSize: 12, color: '#fca5a5' }}>
                Add <code>ANTHROPIC_API_KEY=your_key</code> to your backend <code>.env</code> file.
              </p>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
            {renderText(recommendation)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.2)', textAlign: 'center',
      }}>
        <span style={{ fontSize: 10, color: '#334155' }}>Powered by Claude · Telecom GIS</span>
      </div>
    </div>
  );
};

// ── Types ──────────────────────────────────────────────────────────────────────
type ModalMode = 'create' | 'edit' | 'delete' | null;

const EMPTY_FORM: NewSiteFormValues = {
  site_name: '', region: '', address: '',
  longitude: 9.2, latitude: 33.5,
  technology: '4G', cell_name: '',
  cell_index: 0, azimuth: 0, activity_status: 'active',
};

// ── Main component ─────────────────────────────────────────────────────────────
const NetworkMap: React.FC = () => {
  const [sites, setSites]               = useState<SiteFeature[]>([]);
  const [stats, setStats]               = useState<NetworkStats[]>([]);
  const [activeTech, setActiveTech]     = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [currentZoom, setCurrentZoom]   = useState(7);
  const [showCoverage, setShowCoverage] = useState(false);
  const [mapStyle, setMapStyle]         = useState<'street' | 'satellite' | 'dark'>('street');
  const [refreshSignal, setRefreshSignal] = useState(0);

  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState<SiteFeature[]>([]);
  const [showResults, setShowResults]     = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [modalMode, setModalMode]       = useState<ModalMode>(null);
  const [selectedSite, setSelectedSite] = useState<SiteFeature | null>(null);
  const [siteDetail, setSiteDetail]     = useState<SiteDetail | null>(null);
  const [formValues, setFormValues]     = useState<NewSiteFormValues>(EMPTY_FORM);
  const [editPayload, setEditPayload]   = useState<UpdateSitePayload>({});
  const [formError, setFormError]       = useState('');
  const [formLoading, setFormLoading]   = useState(false);

  // AI state
  const [showGaps, setShowGaps]         = useState(false);
  const [gapZones, setGapZones]         = useState<GapZone[]>([]);
  const [gapLoading, setGapLoading]     = useState(false);
  const [gapError, setGapError]         = useState('');
  const [gapMinKm, setGapMinKm]         = useState(8);

  // upgradeTarget: which site's panel is open  { id, name }
  const [upgradeTarget, setUpgradeTarget] = useState<{ id: number; name: string } | null>(null);

  // ── POI Coverage state ────────────────────────────────────────────────────
  const [showPoiPanel, setShowPoiPanel]         = useState(false);
  const [poiCategories, setPoiCategories]       = useState<PoiCategory[]>(['hospital']);
  const [poiRadius, setPoiRadius]               = useState(3);
  const [poiResult, setPoiResult]               = useState<PoiAnalysisResult | null>(null);
  const [poiLoading, setPoiLoading]             = useState(false);
  const [poiError, setPoiError]                 = useState('');
  const [showCoveredPoi, setShowCoveredPoi]     = useState(false); // toggle to also show covered POIs

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => { fetchNetworkStats().then(setStats).catch(console.error); }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleSitesLoaded = useCallback((features: SiteFeature[]) => {
    setSites(features); setLoading(false);
  }, []);

  const refresh = () => {
    setRefreshSignal(v => v + 1);
    fetchNetworkStats().then(setStats).catch(console.error);
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); setShowResults(false); return; }
    const lower = q.toLowerCase().trim();
    const results = sites.filter(s =>
      s.properties.site_name?.toLowerCase().includes(lower) ||
      s.properties.region?.toLowerCase().includes(lower) ||
      s.properties.technologies?.some(t => t.toLowerCase().includes(lower))
    ).slice(0, 8);
    setSearchResults(results);
    setShowResults(true);
  };

  const clearSearch = () => { setSearchQuery(''); setSearchResults([]); setShowResults(false); };

  const closeModal = () => { setModalMode(null); setSelectedSite(null); setSiteDetail(null); setFormError(''); };

  const openEdit = async (site: SiteFeature) => {
    setSelectedSite(site); setFormError(''); setFormLoading(true);
    setModalMode('edit'); setSiteDetail(null);
    try {
      const detail = await fetchSiteDetail(site.properties.id);
      setSiteDetail(detail);
      setEditPayload({ site_name: detail.site_name, region: detail.region, address: detail.address, longitude: detail.longitude, latitude: detail.latitude });
    } catch { setFormError('Failed to load site details.'); }
    finally { setFormLoading(false); }
  };

  const openDelete = (site: SiteFeature) => { setSelectedSite(site); setFormError(''); setModalMode('delete'); };

  // ── Gap Analysis ───────────────────────────────────────────────────────────
  const handleToggleGaps = async () => {
    if (showGaps) { setShowGaps(false); setGapZones([]); return; }
    setGapLoading(true); setGapError('');
    try {
      const result = await fetchCoverageGaps(0.15, gapMinKm);
      setGapZones(result.gaps); setShowGaps(true);
    } catch { setGapError('Failed to load coverage gaps. Check your backend is running.'); }
    finally { setGapLoading(false); }
  };

  // ── POI Coverage handler ──────────────────────────────────────────────────
  const handlePoiAnalyze = async () => {
    if (poiCategories.length === 0) { setPoiError('Select at least one category.'); return; }
    setPoiLoading(true); setPoiError(''); setPoiResult(null);
    try {
      const result = await fetchPoiCoverage(poiCategories, poiRadius);
      setPoiResult(result);
    } catch (err: any) {
      setPoiError(err?.response?.data?.detail || 'Failed to fetch POI data. Try again.');
    } finally { setPoiLoading(false); }
  };

  const togglePoiCategory = (cat: PoiCategory) => {
    setPoiCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setFormError(''); setFormLoading(true);
    try { await createSite(formValues); setModalMode(null); setFormValues(EMPTY_FORM); refresh(); }
    catch (err: any) {
      const d = err.response?.data;
      setFormError((d?.error || 'Failed to create site.') + (d?.detail ? ` — ${d.detail}` : ''));
    } finally { setFormLoading(false); }
  };

  const handleUpdate = async () => {
    if (!selectedSite) return;
    setFormError(''); setFormLoading(true);
    try { await updateSite(selectedSite.properties.id, editPayload); closeModal(); refresh(); }
    catch (err: any) {
      const d = err.response?.data;
      setFormError((d?.error || 'Failed to update site.') + (d?.detail ? ` — ${d.detail}` : ''));
    } finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!selectedSite) return;
    setFormError(''); setFormLoading(true);
    try { await deleteSite(selectedSite.properties.id); closeModal(); refresh(); }
    catch (err: any) {
      const d = err.response?.data;
      setFormError((d?.error || 'Failed to delete site.') + (d?.detail ? ` — ${d.detail}` : ''));
    } finally { setFormLoading(false); }
  };

  // ── Clustering ─────────────────────────────────────────────────────────────
  const clusteredSites = useCallback(() => {
    const getR = (z: number) => z >= 12 ? 0 : z >= 10 ? 0.12 : z >= 8 ? 0.25 : 0.65;
    const radius = getR(currentZoom);
    if (radius === 0) return sites;
    const clusters: { [k: string]: SiteFeature[] } = {};
    sites.forEach(site => {
      const [lng, lat] = site.geometry.coordinates;
      const key = `${Math.round(lat / radius) * radius},${Math.round(lng / radius) * radius}`;
      if (!clusters[key]) clusters[key] = [];
      clusters[key].push(site);
    });
    return Object.values(clusters).map(cs => {
      if (cs.length === 1) return cs[0];
      const avgLat = cs.reduce((s, x) => s + x.geometry.coordinates[1], 0) / cs.length;
      const avgLng = cs.reduce((s, x) => s + x.geometry.coordinates[0], 0) / cs.length;
      return {
        ...cs[0],
        geometry: { type: 'Point' as const, coordinates: [avgLng, avgLat] as [number, number] },
        properties: { ...cs[0].properties, isCluster: true, clusterCount: cs.length, technologies: Array.from(new Set(cs.flatMap(s => s.properties.technologies || []))) },
      } as SiteFeature & { properties: SiteFeature['properties'] & { isCluster: boolean; clusterCount: number } };
    });
  }, [sites, currentZoom])();

  const tileLayers: Record<string, { url: string; attr: string }> = {
    street:    { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '© OpenStreetMap' },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
    dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© CARTO' },
  };

  const totalCells = stats.reduce((sum, s) => sum + parseInt(s.cell_count || '0'), 0);

  const F = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
    <div className={styles.modalField}>
      <label>{label}{required && <span className={styles.required}> *</span>}</label>
      {children}
    </div>
  );

  return (
    <div className={styles.mapPage}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <div className={styles.titleBadge}>TN</div>
          <div>
            <h2 className={styles.title}>Tunisia Telecom Network</h2>
            <p className={styles.subtitle}>Live coverage map · {sites.length.toLocaleString()} sites visible</p>
          </div>
          {loading && <div className={styles.loadingSpinner} />}
        </div>

        <div className={styles.actions}>
          {/* Search */}
          <div className={styles.searchWrapper} ref={searchRef}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={styles.searchInput}
                placeholder="Search by name, region, 4G, 5G…"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
              />
              {searchQuery && <button className={styles.searchClear} onClick={clearSearch}>×</button>}
            </div>
            {showResults && (
              <div className={styles.searchDropdown}>
                {searchResults.length > 0 ? searchResults.map(site => {
                  const color = TECH_COLORS[site.properties.technologies?.[0] || '2G'];
                  return (
                    <div key={site.properties.id} className={styles.searchResult} onClick={() => { clearSearch(); openEdit(site); }}>
                      <div className={styles.searchResultDot} style={{ background: color }} />
                      <div className={styles.searchResultInfo}>
                        <span className={styles.searchResultName}>{site.properties.site_name}</span>
                        <span className={styles.searchResultMeta}>{site.properties.region || '—'} · {site.properties.technologies?.join(', ')}</span>
                      </div>
                      <span className={styles.searchResultCells}>{site.properties.cell_count} cells</span>
                    </div>
                  );
                }) : <div className={styles.searchEmpty}>No sites match "{searchQuery}"</div>}
              </div>
            )}
          </div>

          {/* Tech filters */}
          <div className={styles.filterGroup}>
            {TECHNOLOGIES.map(tech => (
              <button key={tech}
                className={[styles.filterBtn, styles[TECH_CLASS[tech]] ?? '', activeTech === tech ? styles.active : ''].filter(Boolean).join(' ')}
                onClick={() => { setLoading(true); setActiveTech(p => p === tech ? null : tech); }}
                title={TECH_LABELS[tech]}
              >
                <span className={styles.filterDot} style={{ background: TECH_COLORS[tech] }} />
                {tech}
              </button>
            ))}
          </div>

          <div className={styles.controlButtons}>
            <div className={styles.styleSwitcher}>
              {(['street', 'satellite', 'dark'] as const).map(s => (
                <button key={s} className={[styles.styleBtn, mapStyle === s ? styles.active : ''].join(' ')} onClick={() => setMapStyle(s)}>
                  {s === 'street' ? '🗺' : s === 'satellite' ? '🛰' : '🌙'}
                </button>
              ))}
            </div>
            <button className={[styles.controlBtn, showCoverage ? styles.active : ''].join(' ')} onClick={() => setShowCoverage(c => !c)}>
              📡 {showCoverage ? 'Hide' : 'Show'} Coverage
            </button>
            {/* Gap Analysis button */}
            <button
              className={[styles.controlBtn, showGaps ? styles.active : ''].join(' ')}
              onClick={handleToggleGaps}
              disabled={gapLoading}
              style={showGaps ? { borderColor: '#ff1744', color: '#ff1744' } : {}}
            >
              {gapLoading ? '⏳ Analyzing…' : showGaps ? '🔴 Hide Gaps' : '🔍 Gap Analysis'}
            </button>
            {/* ── POI Coverage button ─────────────────────────────── */}
            <button
              className={[styles.controlBtn, showPoiPanel ? styles.active : ''].join(' ')}
              onClick={() => setShowPoiPanel(v => !v)}
              title="Find uncovered hospitals, schools and ministries"
              style={showPoiPanel ? { borderColor: '#10b981', color: '#10b981' } : {}}
            >
              🏥 POI Coverage
            </button>

            <button className={styles.controlBtn} onClick={() => { setFormValues(EMPTY_FORM); setFormError(''); setModalMode('create'); }}>
              ＋ Add Site
            </button>
            <button className={styles.controlBtn} onClick={() => {
              setActiveTech(null); setShowCoverage(false);
              setShowGaps(false); setGapZones([]); setLoading(true);
            }}>
              ↺ Reset
            </button>
          </div>
        </div>
      </div>

      {/* Gap error banner */}
      {gapError && (
        <div style={{
          position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: '#7f1d1d', color: '#fca5a5', padding: '8px 20px',
          borderRadius: 8, fontSize: 13, zIndex: 2000, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          ⚠ {gapError}
        </div>
      )}

      {/* ── Map container ──────────────────────────────────────────────────── */}
      <div className={styles.mapContainer} style={{ position: 'relative' }}>
        <MapContainer center={TUNISIA_CENTER} zoom={7} minZoom={6} maxZoom={18}
          style={{ height: '100%', width: '100%' }} maxBounds={TUNISIA_BOUNDS} maxBoundsViscosity={1.0}>
          <TileLayer url={tileLayers[mapStyle].url} attribution={tileLayers[mapStyle].attr} />
          <MapEventHandler activeTech={activeTech} onSitesLoaded={handleSitesLoaded} onLoadingChange={setLoading} onZoomChange={setCurrentZoom} reloadSignal={refreshSignal} />
          <MapResizeObserver />

          {/* ── Coverage gap circles — sized by gap distance, colour by severity ── */}
          {showGaps && gapZones.map((gap, idx) => {
            const { color, fillOpacity, weight, radius } = gapStyle(gap.nearestSiteKm);
            const severity = gap.nearestSiteKm > 40 ? '🔴 Critical' : gap.nearestSiteKm > 20 ? '🟠 High priority' : '🟡 Medium priority';
            const badgeBg  = gap.nearestSiteKm > 40 ? '#fef2f2' : gap.nearestSiteKm > 20 ? '#fff7ed' : '#fefce8';
            const badgeFg  = gap.nearestSiteKm > 40 ? '#dc2626' : gap.nearestSiteKm > 20 ? '#ea580c' : '#ca8a04';
            return (
              <Circle
                key={idx}
                center={[gap.lat, gap.lng]}
                radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity, weight, opacity: 0.85 }}
              >
                <Popup className={styles.leafletPopup} maxWidth={230}>
                  <div style={{ padding: '4px 0' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color }}>⚠ Coverage Gap</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 3 }}>
                      <strong>Nearest site:</strong> {gap.nearestSiteKm.toFixed(1)} km away
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 3 }}>
                      <strong>Region:</strong> {gap.region}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>
                      <strong>Coords:</strong> {gap.lat.toFixed(3)}, {gap.lng.toFixed(3)}
                    </div>
                    <div style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: badgeBg, color: badgeFg }}>
                      {severity}
                    </div>
                  </div>
                </Popup>
              </Circle>
            );
          })}

          {/* ── POI markers — uncovered only by default, capped at 300 for perf ── */}
          {(() => {
            if (!poiResult) return null;
            // Uncovered always shown, covered only if toggle is on
            const uncovered = poiResult.pois.filter(p => !p.covered);
            const covered   = showCoveredPoi ? poiResult.pois.filter(p => p.covered) : [];
            // Cap: show worst uncovered first (largest distance), max 300 total markers
            const toRender  = [
              ...uncovered.sort((a, b) => (b.nearestSiteKm ?? 0) - (a.nearestSiteKm ?? 0)).slice(0, 250),
              ...covered.slice(0, 50),
            ];
            return toRender.map(p => {
              const cfg   = POI_CONFIG[p.category];
              const color = p.covered ? cfg.color : cfg.uncoveredColor;
              const icon  = makePoiIcon(cfg.emoji, color, p.covered);
              return (
                <Marker key={`poi-${p.id}`} position={[p.lat, p.lng]} icon={icon} zIndexOffset={p.covered ? 0 : 500}>
                  <Popup className={styles.leafletPopup} maxWidth={260}>
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 22 }}>{cfg.emoji}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'capitalize' }}>{p.subtype}</div>
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 10px', borderRadius: 6, marginBottom: 8, fontSize: 12, fontWeight: 600,
                        background: p.covered ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: p.covered ? '#10b981' : '#ef4444',
                        border: `1px solid ${p.covered ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                        {p.covered ? '✅ Couvert' : '❌ Non couvert'}
                      </div>
                      {p.nearestSiteKm !== null && (
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          <strong>Site le plus proche :</strong> {p.nearestSiteKm.toFixed(2)} km
                          {p.nearestSiteName && <div style={{ color: '#475569', fontSize: 11 }}>{p.nearestSiteName}</div>}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            });
          })()}

          {/* Site markers */}
          {clusteredSites.map(site => {
            const [lng, lat] = site.geometry.coordinates;
            const sp = site.properties as SiteFeature['properties'] & { isCluster?: boolean; clusterCount?: number };
            const isCluster = !!sp.isCluster;
            const primaryTech = activeTech || site.properties.technologies?.[0] || '2G';
            const color = TECH_COLORS[primaryTech] || '#667eea';
            const icon = isCluster ? makeClusterIcon(color, sp.clusterCount ?? 0) : makeTowerIcon(color);

            return (
              <React.Fragment key={`${site.properties.id}-${isCluster ? 'c' : 's'}`}>
                {showCoverage && !isCluster && currentZoom >= 10 && (
                  <Circle center={[lat, lng]} radius={getCoverageRadius(site, activeTech)}
                    pathOptions={{ color, fillColor: color, fillOpacity: 0.10, weight: 1.5, dashArray: '6 4' }} />
                )}
                <Marker position={[lat, lng]} icon={icon}>
                  {!isCluster && currentZoom >= 13 && (
                    <Tooltip direction="top" offset={[0, -38]} permanent opacity={1} className={styles.siteLabel}>
                      {site.properties.site_name}
                    </Tooltip>
                  )}
                  <Popup className={styles.leafletPopup} maxWidth={290}>
                    {isCluster ? (
                      <div className={styles.popupCluster}>
                        <div className={styles.popupClusterTitle}>
                          <span className={styles.popupClusterCount}>{sp.clusterCount}</span> sites in this area
                        </div>
                        <p className={styles.popupCoords}>{lat.toFixed(4)}, {lng.toFixed(4)}</p>
                        <div className={styles.popupTechRow}>
                          {(sp.technologies || []).map((t: string) => (
                            <span key={t} className={styles.techPill} style={{ background: TECH_COLORS[t] }}>{t}</span>
                          ))}
                        </div>
                        <p className={styles.popupHint}>🔍 Zoom in to see individual sites</p>
                      </div>
                    ) : (
                      <div className={styles.popup}>
                        <div className={styles.popupHeader}
                          style={{ background: `linear-gradient(135deg, ${color}22, ${color}08)`, borderLeft: `4px solid ${color}` }}>
                          <div className={styles.popupSiteName}>{site.properties.site_name}</div>
                          <div className={styles.popupRegion}>📍 {site.properties.region || 'Unknown region'}</div>
                        </div>
                        <div className={styles.popupBody}>
                          <div className={styles.popupRow}>
                            <span className={styles.popupLabel}>Cells</span>
                            <span className={styles.popupValue}>{site.properties.cell_count}</span>
                          </div>
                          <div className={styles.popupRow}>
                            <span className={styles.popupLabel}>Technologies</span>
                            <div className={styles.popupTechRow}>
                              {site.properties.technologies?.map((t: string) => (
                                <span key={t} className={styles.techPill} style={{ background: TECH_COLORS[t] }}>{t}</span>
                              ))}
                            </div>
                          </div>
                          <div className={styles.popupRow}>
                            <span className={styles.popupLabel}>Coordinates</span>
                            <span className={styles.popupValue}>{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                          </div>
                          {showCoverage && (
                            <div className={styles.popupRow}>
                              <span className={styles.popupLabel}>Coverage radius</span>
                              <span className={styles.popupValue}>{(getCoverageRadius(site, activeTech) / 1000).toFixed(1)} km</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.popupActions}>
                          <button className={styles.popupEditBtn} onClick={() => openEdit(site)}>✏ Edit</button>
                          <button className={styles.popupDeleteBtn} onClick={() => openDelete(site)}>🗑 Delete</button>
                        </div>
                        {/* AI Upgrade Recommendation — opens the side panel */}
                        <div style={{ padding: '0 12px 12px' }}>
                          <button
                            onClick={() => setUpgradeTarget({ id: site.properties.id, name: site.properties.site_name })}
                            style={{
                              width: '100%', padding: '7px 0',
                              background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
                              color: '#a78bfa', border: '1px solid rgba(139,92,246,0.4)',
                              borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}
                          >
                            🤖 AI Upgrade Recommendation
                          </button>
                        </div>
                      </div>
                    )}
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>

        {/* ── POI Coverage Sidebar — fixed to LEFT, never covers the map ──────── */}
        {showPoiPanel && (
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: 300,
            zIndex: 1100, background: 'rgba(10,15,30,0.97)', backdropFilter: 'blur(16px)',
            borderRight: '1px solid rgba(16,185,129,0.2)',
            boxShadow: '4px 0 24px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', overflowY: 'auto',
          }}>
            {/* Header */}
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(16,185,129,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
                  🏥 POI Coverage
                </div>
                <button onClick={() => { setShowPoiPanel(false); setPoiResult(null); }}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', padding: '3px 8px', fontSize: 15 }}>×</button>
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>Infrastructures non couvertes</div>
            </div>

            <div style={{ padding: '14px 16px', flex: 1 }}>
              {/* Category selector */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Catégories</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(Object.entries(POI_CONFIG) as [PoiCategory, typeof POI_CONFIG[string]][]).map(([cat, cfg]) => (
                    <button key={cat} onClick={() => togglePoiCategory(cat)}
                      style={{
                        padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                        border: `1.5px solid ${poiCategories.includes(cat) ? cfg.uncoveredColor : 'rgba(255,255,255,0.08)'}`,
                        background: poiCategories.includes(cat) ? cfg.uncoveredColor + '18' : 'rgba(255,255,255,0.03)',
                        color: poiCategories.includes(cat) ? cfg.uncoveredColor : '#64748b',
                        transition: 'all 0.15s',
                      }}>
                      <span style={{ fontSize: 16 }}>{cfg.emoji}</span>
                      {cat === 'hospital' ? 'Hôpitaux / Cliniques' : cat === 'school' ? 'Écoles / Universités' : 'Ministères / Mairies'}
                      {poiCategories.includes(cat) && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Radius selector */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Rayon</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{poiRadius} km</div>
                </div>
                <input type="range" min={1} max={10} step={0.5} value={poiRadius}
                  onChange={e => setPoiRadius(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#10b981' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', marginTop: 2 }}>
                  <span>1 km</span><span>5 km</span><span>10 km</span>
                </div>
              </div>

              {/* Analyze button */}
              <button onClick={handlePoiAnalyze} disabled={poiLoading || poiCategories.length === 0}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 8, cursor: poiLoading ? 'wait' : 'pointer',
                  background: poiLoading ? 'rgba(16,185,129,0.15)' : 'linear-gradient(135deg, #059669, #10b981)',
                  color: 'white', border: 'none', fontSize: 13, fontWeight: 700,
                  opacity: poiCategories.length === 0 ? 0.4 : 1, marginBottom: 12,
                }}>
                {poiLoading ? '⏳ Analyse en cours…' : '🔍 Analyser'}
              </button>

              {poiError && (
                <div style={{ color: '#f87171', fontSize: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6, marginBottom: 12 }}>
                  ⚠ {poiError}
                </div>
              )}

              {/* Results summary */}
              {poiResult && !poiLoading && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
                    {[
                      { label: 'Total', value: poiResult.total, color: '#94a3b8' },
                      { label: 'Non couverts', value: poiResult.uncovered, color: '#ef4444' },
                      { label: 'Couverture', value: `${poiResult.coveragePercent}%`, color: '#10b981' },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</div>
                        <div style={{ fontSize: 9, color: '#475569', marginTop: 2 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Toggle covered */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: '#64748b', marginBottom: 12 }}>
                    <input type="checkbox" checked={showCoveredPoi} onChange={e => setShowCoveredPoi(e.target.checked)} style={{ accentColor: '#10b981' }} />
                    Afficher aussi les couverts
                  </label>

                  {/* Uncovered list */}
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                    Non couverts ({poiResult.uncovered})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {poiResult.pois.filter(p => !p.covered).slice(0, 50).map(p => {
                      const cfg = POI_CONFIG[p.category];
                      return (
                        <div key={p.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
                          background: 'rgba(239,68,68,0.06)', borderRadius: 6,
                          border: '1px solid rgba(239,68,68,0.1)',
                        }}>
                          <span style={{ fontSize: 13, flexShrink: 0 }}>{cfg.emoji}</span>
                          <span style={{ flex: 1, color: '#e2e8f0', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>{p.nearestSiteKm?.toFixed(1)} km</span>
                        </div>
                      );
                    })}
                    {poiResult.uncovered > 50 && (
                      <div style={{ fontSize: 11, color: '#475569', textAlign: 'center', paddingTop: 4 }}>
                        +{poiResult.uncovered - 50} autres…
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── AI Upgrade Panel ─────────────────────────────────────────────── */}
        {upgradeTarget && (
          <UpgradePanel
            siteId={upgradeTarget.id}
            siteName={upgradeTarget.name}
            onClose={() => setUpgradeTarget(null)}
          />
        )}

        {/* Gap legend */}
        {showGaps && (
          <div style={{
            position: 'absolute', bottom: 32, left: 16, zIndex: 1000,
            background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(12px)',
            borderRadius: 10, padding: '12px 16px', border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)', minWidth: 200,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Coverage Gap Severity
            </div>
            {[
              { color: '#ff1744', label: 'Critical', desc: '> 40 km' },
              { color: '#ff6d00', label: 'High',     desc: '20–40 km' },
              { color: '#ffd600', label: 'Medium',   desc: `${gapMinKm}–20 km` },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {/* circle swatch matching the map circles */}
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: item.color, opacity: 0.75, flexShrink: 0, border: `2px solid ${item.color}` }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{item.label}</span>
                <span style={{ fontSize: 11, color: '#64748b' }}>{item.desc} from nearest site</span>
              </div>
            ))}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#64748b' }}>
              {gapZones.length} gap zones detected
            </div>
          </div>
        )}

        {/* ── Stats panel ───────────────────────────────────────────────────── */}
        <div className={styles.statsPanel}>
          <div className={styles.statsPanelHeader}>
            <span className={styles.statsPanelTitle}>Network Stats</span>
            <span className={styles.statsPanelTotal}>{totalCells.toLocaleString()} cells</span>
          </div>
          {stats.map(s => {
            const pct = totalCells > 0 ? (parseInt(s.cell_count) / totalCells) * 100 : 0;
            return (
              <div key={s.technology} className={styles.statItem}>
                <div className={styles.statItemTop}>
                  <div className={styles.statItemLeft}>
                    <div className={styles.statDot} style={{ background: TECH_COLORS[s.technology] }} />
                    <span className={styles.statTech}>{s.technology}</span>
                  </div>
                  <span className={styles.statCount}>{parseInt(s.cell_count).toLocaleString()}</span>
                </div>
                <div className={styles.statBar}>
                  <div className={styles.statBarFill} style={{ width: `${pct}%`, background: TECH_COLORS[s.technology] }} />
                </div>
              </div>
            );
          })}

          <div className={styles.statsSeparator} />
          <div style={{ marginBottom: 12 }}>
            <div className={styles.legendTitle}>🔍 Gap Analysis</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>Min gap:</label>
              <input
                type="range" min={4} max={30} step={2} value={gapMinKm}
                onChange={e => setGapMinKm(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#ff1744' }}
                disabled={showGaps}
              />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', minWidth: 36 }}>{gapMinKm} km</span>
            </div>
            {showGaps && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#ff6d00' }}>
                🔴 {gapZones.length} gaps · Click zones for details
              </div>
            )}
          </div>

          <div className={styles.statsSeparator} />
          <div className={styles.legendTitle}>Icon Legend</div>
          {TECHNOLOGIES.map(tech => (
            <div key={tech} className={styles.legendItem}>
              <svg width="20" height="20" viewBox="0 0 34 34">
                <circle cx="17" cy="17" r="14" fill={TECH_COLORS[tech]} opacity="0.15" />
                <circle cx="17" cy="17" r="11" fill="white" stroke={TECH_COLORS[tech]} strokeWidth="2" />
                <line x1="17" y1="9" x2="17" y2="24" stroke={TECH_COLORS[tech]} strokeWidth="2" strokeLinecap="round" />
                <line x1="13" y1="14" x2="21" y2="14" stroke={TECH_COLORS[tech]} strokeWidth="1.6" strokeLinecap="round" />
                <line x1="14" y1="19" x2="20" y2="19" stroke={TECH_COLORS[tech]} strokeWidth="1.4" strokeLinecap="round" />
                <line x1="13" y1="9" x2="21" y2="9" stroke={TECH_COLORS[tech]} strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span className={styles.legendLabel}>{tech}</span>
              <span className={styles.legendDesc}>{TECH_LABELS[tech]}</span>
            </div>
          ))}
          {showCoverage && (
            <>
              <div className={styles.statsSeparator} />
              <div className={styles.legendTitle}>Coverage Radius</div>
              {TECHNOLOGIES.map(tech => (
                <div key={tech} className={styles.coverageItem}>
                  <div className={styles.coverageDash} style={{ borderColor: TECH_COLORS[tech] }} />
                  <span style={{ color: TECH_COLORS[tech], fontWeight: 600, fontSize: 11 }}>{tech}</span>
                  <span className={styles.coverageKm}>{(BASE_RADIUS[tech] / 1000).toFixed(1)} km</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Modals ────────────────────────────────────────────────────────── */}
        {modalMode !== null && (
          <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <div className={styles.modal}>

              {modalMode === 'create' && (<>
                <div className={styles.modalHeader}>
                  <div>
                    <h3 className={styles.modalTitle}>Add New Site</h3>
                    <p className={styles.modalSubtitle}>Register a new cell tower and its first cell</p>
                  </div>
                  <button className={styles.closeButton} onClick={closeModal}>×</button>
                </div>
                <div className={styles.modalBody}>
                  {formError && <div className={styles.formError}>⚠ {formError}</div>}
                  <div className={styles.modalSection}>
                    <div className={styles.modalSectionTitle}>Site Information</div>
                    <div className={styles.modalGrid3}>
                      <div className={[styles.modalField, styles.span2].join(' ')}>
                        <F label="Site Name" required>
                          <input value={formValues.site_name} onChange={e => setFormValues(p => ({ ...p, site_name: e.target.value }))} placeholder="e.g. TUN_SFAX_001" />
                        </F>
                      </div>
                      <F label="Region">
                        <input value={formValues.region} onChange={e => setFormValues(p => ({ ...p, region: e.target.value }))} placeholder="e.g. Sfax" />
                      </F>
                    </div>
                    <F label="Address">
                      <input value={formValues.address} onChange={e => setFormValues(p => ({ ...p, address: e.target.value }))} placeholder="Street address or landmark" />
                    </F>
                    <div className={styles.modalGrid}>
                      <F label="Latitude" required>
                        <input type="number" step="0.0001" value={formValues.latitude} onChange={e => setFormValues(p => ({ ...p, latitude: Number(e.target.value) }))} />
                      </F>
                      <F label="Longitude" required>
                        <input type="number" step="0.0001" value={formValues.longitude} onChange={e => setFormValues(p => ({ ...p, longitude: Number(e.target.value) }))} />
                      </F>
                    </div>
                  </div>
                  <div className={styles.modalSection}>
                    <div className={styles.modalSectionTitle}>Cell Configuration</div>
                    <div className={styles.modalGrid}>
                      <F label="Cell Name" required>
                        <input value={formValues.cell_name} onChange={e => setFormValues(p => ({ ...p, cell_name: e.target.value }))} placeholder="e.g. TUN_SFAX_001_1" />
                      </F>
                      <F label="Technology" required>
                        <select value={formValues.technology} onChange={e => setFormValues(p => ({ ...p, technology: e.target.value }))}>
                          {TECHNOLOGIES.map(t => <option key={t} value={t}>{TECH_LABELS[t] || t}</option>)}
                        </select>
                      </F>
                    </div>
                    <div className={styles.modalGrid}>
                      <F label="Cell Index">
                        <input type="number" value={formValues.cell_index} onChange={e => setFormValues(p => ({ ...p, cell_index: Number(e.target.value) }))} />
                      </F>
                      <F label="Azimuth (°)">
                        <input type="number" min="0" max="359" value={formValues.azimuth} onChange={e => setFormValues(p => ({ ...p, azimuth: Number(e.target.value) }))} />
                      </F>
                      <F label="Status">
                        <select value={formValues.activity_status} onChange={e => setFormValues(p => ({ ...p, activity_status: e.target.value }))}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </F>
                    </div>
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                  <button className={styles.saveBtn} onClick={handleCreate} disabled={formLoading}>
                    {formLoading ? '⏳ Saving…' : '✓ Save Site'}
                  </button>
                </div>
              </>)}

              {modalMode === 'edit' && (<>
                <div className={styles.modalHeader}>
                  <div>
                    <h3 className={styles.modalTitle}>Edit Site</h3>
                    <p className={styles.modalSubtitle}>{selectedSite?.properties.site_name}</p>
                  </div>
                  <button className={styles.closeButton} onClick={closeModal}>×</button>
                </div>
                <div className={styles.modalBody}>
                  {formError && <div className={styles.formError}>⚠ {formError}</div>}
                  {formLoading && !siteDetail ? (
                    <div className={styles.modalLoading}>
                      <div className={styles.loadingSpinner} />
                      <span>Loading site details…</span>
                    </div>
                  ) : (<>
                    <div className={styles.modalSection}>
                      <div className={styles.modalSectionTitle}>Site Information</div>
                      <div className={styles.modalGrid3}>
                        <div className={[styles.modalField, styles.span2].join(' ')}>
                          <F label="Site Name">
                            <input value={editPayload.site_name || ''} onChange={e => setEditPayload(p => ({ ...p, site_name: e.target.value }))} />
                          </F>
                        </div>
                        <F label="Region">
                          <input value={editPayload.region || ''} onChange={e => setEditPayload(p => ({ ...p, region: e.target.value }))} />
                        </F>
                      </div>
                      <F label="Address">
                        <input value={editPayload.address || ''} onChange={e => setEditPayload(p => ({ ...p, address: e.target.value }))} />
                      </F>
                      <div className={styles.modalGrid}>
                        <F label="Latitude">
                          <input type="number" step="0.0001" value={editPayload.latitude ?? ''} onChange={e => setEditPayload(p => ({ ...p, latitude: Number(e.target.value) }))} />
                        </F>
                        <F label="Longitude">
                          <input type="number" step="0.0001" value={editPayload.longitude ?? ''} onChange={e => setEditPayload(p => ({ ...p, longitude: Number(e.target.value) }))} />
                        </F>
                      </div>
                    </div>
                    {siteDetail?.cells && siteDetail.cells.length > 0 && (
                      <div className={styles.modalSection}>
                        <div className={styles.modalSectionTitle}>Cells on this site ({siteDetail.cells.length})</div>
                        <div className={styles.cellsList}>
                          {siteDetail.cells.map(cell => (
                            <div key={cell.id} className={styles.cellRow}>
                              <span className={styles.techPill} style={{ background: TECH_COLORS[cell.technology] }}>{cell.technology}</span>
                              <span className={styles.cellName}>{cell.cell_name}</span>
                              <span className={styles.cellMeta}>Az {cell.azimuth}°</span>
                              <span className={[styles.cellStatus, cell.activity_status === 'active' ? styles.statusActive : styles.statusInactive].join(' ')}>
                                {cell.activity_status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>)}
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                  <button className={styles.saveBtn} onClick={handleUpdate} disabled={formLoading}>
                    {formLoading ? '⏳ Saving…' : '✓ Save Changes'}
                  </button>
                </div>
              </>)}

              {modalMode === 'delete' && (<>
                <div className={styles.modalHeader}>
                  <div>
                    <h3 className={styles.modalTitle}>Delete Site</h3>
                    <p className={styles.modalSubtitle}>This action cannot be undone</p>
                  </div>
                  <button className={styles.closeButton} onClick={closeModal}>×</button>
                </div>
                <div className={styles.modalBody}>
                  {formError && <div className={styles.formError}>⚠ {formError}</div>}
                  <div className={styles.deleteConfirm}>
                    <div className={styles.deleteIcon}>🗑</div>
                    <p className={styles.deleteMessage}>
                      Are you sure you want to delete <strong>{selectedSite?.properties.site_name}</strong>?
                    </p>
                    <p className={styles.deleteWarning}>
                      This will permanently remove the site and all <strong>{selectedSite?.properties.cell_count}</strong> cell{selectedSite?.properties.cell_count !== 1 ? 's' : ''} associated with it.
                    </p>
                  </div>
                </div>
                <div className={styles.modalActions}>
                  <button className={styles.cancelBtn} onClick={closeModal}>Cancel</button>
                  <button className={styles.deleteBtn} onClick={handleDelete} disabled={formLoading}>
                    {formLoading ? '⏳ Deleting…' : '🗑 Yes, Delete Site'}
                  </button>
                </div>
              </>)}

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkMap;