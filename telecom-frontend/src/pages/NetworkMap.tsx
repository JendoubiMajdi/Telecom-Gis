import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents, useMap } from 'react-leaflet';
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
}: {
  activeTech: string | null;
  onSitesLoaded: (features: SiteFeature[]) => void;
}) {
  const loadingRef = useRef(false);

  const load = useCallback(
    async (bounds: LatLngBounds) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const bbox: [number, number, number, number] = [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ];
        const data = await fetchSites(bbox, activeTech || undefined);
        onSitesLoaded(data.features);
      } catch (err) {
        console.error('Failed to load sites:', err);
      } finally {
        loadingRef.current = false;
      }
    },
    [activeTech, onSitesLoaded]
  );

  const map = useMapEvents({
    moveend: () => load(map.getBounds()),
    zoomend: () => load(map.getBounds()),
  });

  useEffect(() => {
    load(map.getBounds());
  }, [activeTech]);

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

  return (
    <div className={styles.mapPage}>
      <div className={styles.controls}>
        <h2>Tunisia Network Map</h2>
        {TECHNOLOGIES.map((tech) => (
          <button
            key={tech}
            className={[
              styles.filterBtn,
              styles[TECH_CLASS[tech]],
              activeTech === tech ? styles.active : '',
            ].join(' ')}
            onClick={() => handleTechFilter(tech)}
          >
            {tech}
          </button>
        ))}
        <div className={styles.stats}>
          {stats.map((s) => (
            <div key={s.technology} className={styles.statBadge}>
              {s.technology}: <span>{parseInt(s.cell_count).toLocaleString()}</span> cells
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: '600px', position: 'relative' }}>
        {loading && <div className={styles.loading}>Loading sites...</div>}
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
          />
          <MapResizeObserver />
          {sites.map((site) => {
            const [lng, lat] = site.geometry.coordinates;
            const primaryTech = activeTech || site.properties.technologies?.[0] || '2G';
            const color = TECH_COLORS[primaryTech] || '#667eea';
            return (
              <CircleMarker
                key={site.properties.id}
                center={[lat, lng]}
                radius={5}
                pathOptions={{
                  color: color,
                  fillColor: color,
                  fillOpacity: 0.8,
                  weight: 1,
                }}
              >
                <Popup>
                  <div className={styles.popup}>
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
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
};

export default NetworkMap;