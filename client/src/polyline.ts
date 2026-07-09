// Google encoded polyline algorithm (precision 1e5), as used by Strava's
// map.summary_polyline
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

export interface RouteGeometry {
  d: string;
  start: [number, number];
  end: [number, number];
}

// projects lat/lng onto the SVG viewBox (equirectangular with latitude
// correction), centered and aspect-preserving
export function routeGeometry(
  encoded: string,
  width: number,
  height: number,
  padding: number,
): RouteGeometry | null {
  const latLngs = decodePolyline(encoded);
  if (latLngs.length < 2) return null;

  const midLat =
    (latLngs.reduce((s, p) => s + p[0], 0) / latLngs.length) * (Math.PI / 180);
  const cosLat = Math.cos(midLat);

  const projected = latLngs.map(
    ([lat, lng]) => [lng * cosLat, -lat] as [number, number],
  );

  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);

  const scale = Math.min(
    (width - 2 * padding) / spanX,
    (height - 2 * padding) / spanY,
  );
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  const points = projected.map(
    ([x, y]) =>
      [(x - minX) * scale + offsetX, (y - minY) * scale + offsetY] as [
        number,
        number,
      ],
  );

  const d = points
    .map(
      ([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`,
    )
    .join(' ');

  return { d, start: points[0], end: points[points.length - 1] };
}
