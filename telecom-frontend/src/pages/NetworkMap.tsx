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
  createSite,
  updateSite,
  deleteSite,
  fetchSiteDetail,
  NewSiteFormValues,
  UpdateSitePayload,
} from '../services/network.service';

const TECHNOLOGIES = ['2G', '3G', '4G', '5G', '5G_FDD', '5G_TDD'] as const;

const TECH_COLORS: Record<string, string> = {
  '2G':     '#22c55e',
  '3G':     '#f97316',
  '4G':     '#3b82f6',
  '5G':     '#a855f7',
  '5G_FDD': '#ec4899',
  '5G_TDD': '#06b6d4',
};

const TECH_CLASS: Record<string, string> = {
  '2G':     'tech2g',
  '3G':     'tech3g',
  '4G':     'tech4g',
  '5G':     'tech5g',
  '5G_FDD': 'tech5gfdd',
  '5G_TDD': 'tech5gtdd',
};

const TECH_LABELS: Record<string, string> = {
  '2G':     '2G GSM',
  '3G':     '3G UMTS',
  '4G':     '4G LTE',
  '5G':     '5G NR',
  '5G_FDD': '5G FDD',
  '5G_TDD': '5G TDD',
};

const BASE_RADIUS: Record<string, number> = {
  '2G': 8000, '3G': 5000, '4G': 3000, '5G': 1200, '5G_FDD': 1500, '5G_TDD': 900,
};

// ── Icon factories ─────────────────────────────────────────────────────────────
function makeTowerIcon(color: string, size = 34): L.DivIcon {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + 6}" viewBox="0 0 34 40">
    <defs>
      <filter id="sh" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
    </defs>
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

  // Search
  const [searchQuery, setSearchQuery]       = useState('');
  const [searchResults, setSearchResults]   = useState<SiteFeature[]>([]);
  const [showResults, setShowResults]       = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [modalMode, setModalMode]         = useState<ModalMode>(null);
  const [selectedSite, setSelectedSite]   = useState<SiteFeature | null>(null);
  const [siteDetail, setSiteDetail]       = useState<SiteDetail | null>(null);
  const [formValues, setFormValues]       = useState<NewSiteFormValues>(EMPTY_FORM);
  const [editPayload, setEditPayload]     = useState<UpdateSitePayload>({});
  const [formError, setFormError]         = useState('');
  const [formLoading, setFormLoading]     = useState(false);

  // Leaflet CSS
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => { fetchNetworkStats().then(setStats).catch(console.error); }, []);

  // Close search on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleSitesLoaded = useCallback((features: SiteFeature[]) => {
    setSites(features);
    setLoading(false);
  }, []);

  const refresh = () => {
    setRefreshSignal(v => v + 1);
    fetchNetworkStats().then(setStats).catch(console.error);
  };

  // ── Search ─────────────────────────────────────────────────────────────────
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

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const closeModal = () => { setModalMode(null); setSelectedSite(null); setSiteDetail(null); setFormError(''); };

  const openEdit = async (site: SiteFeature) => {
    setSelectedSite(site);
    setFormError('');
    setFormLoading(true);
    setModalMode('edit');
    setSiteDetail(null);
    try {
      const detail = await fetchSiteDetail(site.properties.id);
      setSiteDetail(detail);
      setEditPayload({ site_name: detail.site_name, region: detail.region, address: detail.address, longitude: detail.longitude, latitude: detail.latitude });
    } catch { setFormError('Failed to load site details.'); }
    finally { setFormLoading(false); }
  };

  const openDelete = (site: SiteFeature) => { setSelectedSite(site); setFormError(''); setModalMode('delete'); };

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setFormError(''); setFormLoading(true);
    try {
      await createSite(formValues);
      setModalMode(null); setFormValues(EMPTY_FORM); refresh();
    } catch (err: any) {
      const d = err.response?.data;
      setFormError((d?.error || 'Failed to create site.') + (d?.detail ? ` — ${d.detail}` : ''));
    } finally { setFormLoading(false); }
  };

  const handleUpdate = async () => {
    if (!selectedSite) return;
    setFormError(''); setFormLoading(true);
    try {
      await updateSite(selectedSite.properties.id, editPayload);
      closeModal(); refresh();
    } catch (err: any) {
      const d = err.response?.data;
      setFormError((d?.error || 'Failed to update site.') + (d?.detail ? ` — ${d.detail}` : ''));
    } finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!selectedSite) return;
    setFormError(''); setFormLoading(true);
    try {
      await deleteSite(selectedSite.properties.id);
      closeModal(); refresh();
    } catch (err: any) {
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

  // Reusable form field wrapper
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

          {/* ── Search bar ───────────────────────────────────────────────── */}
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
                }) : (
                  <div className={styles.searchEmpty}>No sites match "{searchQuery}"</div>
                )}
              </div>
            )}
          </div>

          {/* ── Tech filters ──────────────────────────────────────────────── */}
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
            <button className={styles.controlBtn} onClick={() => { setFormValues(EMPTY_FORM); setFormError(''); setModalMode('create'); }}>
              ＋ Add Site
            </button>
            <button className={styles.controlBtn} onClick={() => { setActiveTech(null); setShowCoverage(false); setLoading(true); }}>
              ↺ Reset
            </button>
          </div>
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      <div className={styles.mapContainer}>
        <MapContainer center={TUNISIA_CENTER} zoom={7} minZoom={6} maxZoom={18}
          style={{ height: '100%', width: '100%' }} maxBounds={TUNISIA_BOUNDS} maxBoundsViscosity={1.0}>
          <TileLayer url={tileLayers[mapStyle].url} attribution={tileLayers[mapStyle].attr} />
          <MapEventHandler activeTech={activeTech} onSitesLoaded={handleSitesLoaded} onLoadingChange={setLoading} onZoomChange={setCurrentZoom} reloadSignal={refreshSignal} />
          <MapResizeObserver />

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
                        {/* Edit / Delete action buttons */}
                        <div className={styles.popupActions}>
                          <button className={styles.popupEditBtn} onClick={() => openEdit(site)}>✏ Edit</button>
                          <button className={styles.popupDeleteBtn} onClick={() => openDelete(site)}>🗑 Delete</button>
                        </div>
                      </div>
                    )}
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>

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

        {/* ════ MODALS ═══════════════════════════════════════════════════════ */}
        {modalMode !== null && (
          <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
            <div className={styles.modal}>

              {/* ── CREATE ──────────────────────────────────────────────── */}
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

              {/* ── EDIT ────────────────────────────────────────────────── */}
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

              {/* ── DELETE ──────────────────────────────────────────────── */}
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