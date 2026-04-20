import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, Circle, useMapEvents, useMap } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import styles from './NetworkMap.module.css';
import { fetchSites, fetchNetworkStats, NetworkStats, SiteFeature } from '../services/network.service';

const TECHNOLOGIES = ['2G', '3G', '4G', '5G', '5G_FDD', '5G_TDD'] as const;

const TECH_COLORS: Record<string, string> = {
  '2G':     '#48bb78',
  '3G':     '#ed8936',
  '4G':     '#4299e1',
  '5G':     '#9f7aea',
  '5G_FDD': '#b794f4',
  '5G_TDD': '#76e4f7',
};

const TECH_CLASS: Record<string, string> = {
  '2G':     'tech2g',
  '3G':     'tech3g',
  '4G':     'tech4g',
  '5G':     'tech5g',
  '5G_FDD': 'tech5gfdd',
  '5G_TDD': 'tech5gtdd',
};

const TUNISIA_CENTER: [number, number] = [33.5, 9.2];

// Tunisia tight bounding box
const TUNISIA_BOUNDS: [[number, number], [number, number]] = [
  [29.5, 7.5],
  [38.0, 11.8],
];

function MapEventHandler({
  activeTech,
  onSitesLoaded,
  onLoadingChange,
  onZoomChange,
}: {
  activeTech: string | null;
  onSitesLoaded: (features: SiteFeature[]) => void;
  onLoadingChange: (loading: boolean) => void;
  onZoomChange: (zoom: number) => void;
}) {
  const loadingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<Map<string, { data: SiteFeature[]; timestamp: number }>>(new Map());

  // Cache key generator
  const getCacheKey = useCallback((bounds: LatLngBounds, tech: string | null) => {
    const bbox = [
      Math.round(bounds.getWest() * 100) / 100,
      Math.round(bounds.getSouth() * 100) / 100,
      Math.round(bounds.getEast() * 100) / 100,
      Math.round(bounds.getNorth() * 100) / 100,
    ].join(',');
    return `${bbox}-${tech || 'all'}`;
  }, []);

  // Check if cached data is still valid (5 minutes)
  const isCacheValid = useCallback((timestamp: number) => {
    return Date.now() - timestamp < 5 * 60 * 1000;
  }, []);

  const load = useCallback(
    async (bounds: LatLngBounds, force = false) => {
      if (loadingRef.current && !force) return;

      const cacheKey = getCacheKey(bounds, activeTech);

      // Check cache first
      const cached = cacheRef.current.get(cacheKey);
      if (cached && isCacheValid(cached.timestamp) && !force) {
        onSitesLoaded(cached.data);
        return;
      }

      loadingRef.current = true;
      onLoadingChange(true);

      try {
        const bbox: [number, number, number, number] = [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ];
        const data = activeTech
          ? await fetchSites(bbox, activeTech)
          : await fetchSites(bbox);

        // Cache the result
        cacheRef.current.set(cacheKey, {
          data: data.features,
          timestamp: Date.now()
        });

        // Limit cache size
        if (cacheRef.current.size > 20) {
          const firstKey = cacheRef.current.keys().next().value;
          cacheRef.current.delete(firstKey);
        }

        onSitesLoaded(data.features);
      } catch (err) {
        console.error('Failed to load sites:', err);
      } finally {
        loadingRef.current = false;
        onLoadingChange(false);
      }
    },
    [activeTech, onSitesLoaded, onLoadingChange, getCacheKey, isCacheValid]
  );

  const debouncedLoad = useCallback(
    (bounds: LatLngBounds) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        load(bounds);
      }, 300); // 300ms debounce
    },
    [load]
  );

  const map = useMapEvents({
    moveend: () => {
      debouncedLoad(map.getBounds());
      onZoomChange(map.getZoom());
    },
    zoomend: () => {
      debouncedLoad(map.getBounds());
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    onZoomChange(map.getZoom()); // Initial zoom
    load(map.getBounds(), true); // Force load on tech change
  }, [activeTech]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return null;
}

function MapResizeObserver() {
  const map = useMap();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  return null;
}

const NetworkMap: React.FC = () => {
  const [sites, setSites] = useState<SiteFeature[]>([]);
  const [stats, setStats] = useState<NetworkStats[]>([]);
  const [activeTech, setActiveTech] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(7);
  const [showCoverage, setShowCoverage] = useState(false);

  const getCoverageRadius = useCallback((site: SiteFeature) => {
    const primaryTech = activeTech || site.properties.technologies?.[0] || '2G';
    const baseRadius: Record<string, number> = {
      '2G': 1600,
      '3G': 1200,
      '4G': 850,
      '5G': 450,
      '5G_FDD': 520,
      '5G_TDD': 420,
    };
    const techRadius = baseRadius[primaryTech] ?? 900;
    const scale = 1 + Math.min(site.properties.cell_count - 1, 4) * 0.12;
    return Math.round(techRadius * scale);
  }, [activeTech]);

  const resetFilters = () => {
    setActiveTech(null);
    setShowCoverage(false);
    setLoading(true);
  };

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    fetchNetworkStats().then(setStats).catch(console.error);
  }, []);

  const handleSitesLoaded = useCallback((features: SiteFeature[]) => {
    setSites(features);
    setLoading(false);
  }, []);

  const handleTechFilter = (tech: string) => {
    setLoading(true);
    setActiveTech((prev) => (prev === tech ? null : tech));
  };

  // Calculate zoom-based clustering radius in degrees.
  const getClusterRadius = (zoom: number) => {
    if (zoom >= 12) return 0; // No clustering at high zoom
    if (zoom >= 10) return 0.14;
    if (zoom >= 8) return 0.28;
    return 0.75; // Heavy clustering at low zoom
  };

  // Group sites by location for clustering
  const getClusteredSites = useCallback(() => {
    const radius = getClusterRadius(currentZoom);

    if (radius === 0) return sites;

    const clusters: { [key: string]: SiteFeature[] } = {};
    sites.forEach(site => {
      const [lng, lat] = site.geometry.coordinates;
      const clusterKey = `${Math.round(lat / radius) * radius},${Math.round(lng / radius) * radius}`;

      if (!clusters[clusterKey]) {
        clusters[clusterKey] = [];
      }
      clusters[clusterKey].push(site);
    });

    return Object.values(clusters).map(clusterSites => {
      if (clusterSites.length === 1) return clusterSites[0];

      // Create cluster marker
      const avgLat = clusterSites.reduce((sum, s) => sum + s.geometry.coordinates[1], 0) / clusterSites.length;
      const avgLng = clusterSites.reduce((sum, s) => sum + s.geometry.coordinates[0], 0) / clusterSites.length;

      return {
        ...clusterSites[0],
        geometry: { coordinates: [avgLng, avgLat] },
        properties: {
          ...clusterSites[0].properties,
          isCluster: true,
          clusterCount: clusterSites.length,
          technologies: Array.from(new Set(clusterSites.flatMap(s => s.properties.technologies || [])))
        }
      } as SiteFeature & {
        properties: SiteFeature['properties'] & {
          isCluster: true;
          clusterCount: number;
          technologies: string[];
        };
      };
    });
  }, [sites, currentZoom]);

  const clusteredSites = getClusteredSites();

  return (
    <div className={styles.mapPage}>
      {/* Header Controls */}
      <div className={styles.header}>
          <div className={styles.titleSection}>
          <div>
            <h2>Tunisia Telecom Network Map</h2>
            <p className={styles.subtitle}>Telecom network coverage map</p>
          </div>
          {loading && <div className={styles.loadingSpinner}>Loading...</div>}
        </div>

        <div className={styles.actions}>
          <div className={styles.filterGroup}>
            {TECHNOLOGIES.map((tech) => (
              <button
                key={tech}
                className={[
                  styles.filterBtn,
                  styles[TECH_CLASS[tech]] ?? '',
                  activeTech === tech ? styles.active : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleTechFilter(tech)}
              >
                {tech}
              </button>
            ))}
          </div>

          <div className={styles.controlButtons}>
            <button
              className={[styles.smallBtn, showCoverage ? styles.active : ''].join(' ')}
              onClick={() => setShowCoverage((current) => !current)}
            >
              {showCoverage ? 'Hide coverage' : 'Show coverage'}
            </button>
            <button className={styles.smallBtn} onClick={resetFilters}>Reset</button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className={styles.mapContainer}>
        <MapContainer
          center={TUNISIA_CENTER}
          zoom={7}
          minZoom={6}
          maxZoom={18}
          style={{ height: '100%', width: '100%' }}
          maxBounds={TUNISIA_BOUNDS}
          maxBoundsViscosity={1.0}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapEventHandler
            activeTech={activeTech}
            onSitesLoaded={handleSitesLoaded}
            onLoadingChange={setLoading}
            onZoomChange={setCurrentZoom}
          />
          <MapResizeObserver />

          {/* Render sites or clusters */}
          {clusteredSites.map((site) => {
            const [lng, lat] = site.geometry.coordinates;
            const primaryTech = activeTech || site.properties.technologies?.[0] || '2G';
            const color = TECH_COLORS[primaryTech] || '#667eea';
            const siteProps = site.properties as SiteFeature['properties'] & {
              isCluster?: boolean;
              clusterCount?: number;
            };
            const isCluster = !!siteProps.isCluster;
            const markerRadius = isCluster ? Math.min(10 + (siteProps.clusterCount ?? 0) * 1.7, 28) : 5;
            const coverageRadius = getCoverageRadius(site);

            return (
              <React.Fragment key={`${site.properties.id}-${isCluster ? 'cluster' : 'site'}`}>
                {showCoverage && !isCluster && currentZoom >= 12 && (
                  <Circle
                    center={[lat, lng]}
                    radius={coverageRadius}
                    pathOptions={{
                      color: color,
                      fillColor: color,
                      fillOpacity: 0.08,
                      weight: 1,
                    }}
                  />
                )}
                <CircleMarker
                  center={[lat, lng]}
                  radius={markerRadius}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: isCluster ? 0.65 : 0.9,
                    weight: isCluster ? 2 : 1,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.9} permanent={currentZoom >= 13}>
                    {isCluster ? `${siteProps.clusterCount ?? 0} sites` : site.properties.site_name}
                  </Tooltip>
                  <Popup>
                    <div className={styles.popup}>
                    {isCluster ? (
                      <>
                        <h4>Cluster ({siteProps.clusterCount ?? 0} sites)</h4>
                        <p>Center: {lat.toFixed(4)}, {lng.toFixed(4)}</p>
                        <p>Technologies: {siteProps.technologies?.join(', ')}</p>
                        <small>Zoom in to see individual sites</small>
                      </>
                    ) : (
                      <>
                        <h4>{site.properties.site_name}</h4>
                        <p>Region: {site.properties.region || '—'}</p>
                        <p>Cells: {site.properties.cell_count}</p>
                        <p>
                          {site.properties.technologies?.map((t: string) => (
                            <span
                              key={t}
                              className={styles.techBadge}
                              style={{ background: TECH_COLORS[t] || '#667eea' }}
                            >
                              {t}
                            </span>
                          ))}
                        </p>
                      </>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
            );
          })}
        </MapContainer>

        {/* Stats Panel */}
        <div className={styles.statsPanel}>
          <h4>Network Statistics</h4>
          {stats.map((s) => (
            <div key={s.technology} className={styles.statItem}>
              <span className={styles.statTech}>{s.technology}:</span>
              <span className={styles.statCount}>{parseInt(s.cell_count).toLocaleString()}</span>
            </div>
          ))}
          <div className={styles.statItem}>
            <span className={styles.statTech}>Total Sites:</span>
            <span className={styles.statCount}>{sites.length.toLocaleString()}</span>
          </div>

          <div className={styles.legendSection}>
            <h4>Legend</h4>
            {TECHNOLOGIES.map(tech => (
              <div key={tech} className={styles.legendItem}>
                <div
                  className={styles.legendColor}
                  style={{ backgroundColor: TECH_COLORS[tech] }}
                />
                <span>{tech}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkMap;