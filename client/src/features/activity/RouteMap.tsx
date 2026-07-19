import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { decodePolyline } from '@/lib/polyline';

// route/marker colors come from the theme tokens via CSS classes in index.css
// (.route-line, .route-start, .route-end), so they react to theme switches
export default function RouteMap({ polyline }: { polyline: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const latLngs = decodePolyline(polyline).map(([lat, lng]) =>
      L.latLng(lat, lng),
    );
    if (latLngs.length < 2) return;

    const map = L.map(el, {
      zoomControl: false,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const line = L.polyline(latLngs, {
      className: 'route-line',
      weight: 3,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    L.circleMarker(latLngs[0], {
      className: 'route-start',
      radius: 5.5,
      weight: 2.5,
    }).addTo(map);
    L.circleMarker(latLngs[latLngs.length - 1], {
      className: 'route-end',
      radius: 5.5,
      weight: 2.5,
    }).addTo(map);

    map.fitBounds(line.getBounds(), { padding: [24, 24], maxZoom: 16 });

    return () => {
      map.remove();
    };
  }, [polyline]);

  // relative + z-0 boxes Leaflet's internal panes/controls (z-index up to
  // 1000) into their own stacking context — without it those z-indexes
  // compare directly against the app's fixed header/drawer and bleed on top
  // of them on drag/pan
  return <div ref={containerRef} className="relative z-0 aspect-8/3 w-full" />;
}
