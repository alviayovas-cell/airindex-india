/**
 * Minimal, self-contained geographic projection for the India route map.
 * Schematic — an equirectangular projection with a longitude cosine correction
 * at India's mid-latitude. No external map tiles or libraries.
 */

// Bounding box that comfortably contains mainland India.
export const LON_MIN = 67;
export const LON_MAX = 98;
export const LAT_MIN = 6;
export const LAT_MAX = 37;

const MID_LAT = (LAT_MIN + LAT_MAX) / 2;
const LON_SCALE = Math.cos((MID_LAT * Math.PI) / 180); // ~0.92

/** Project (lat, lon) into an SVG coordinate inside a `width` x `height` box. */
export function projectLatLng(
  lat: number,
  lon: number,
  width: number,
  height: number,
): [number, number] {
  const lonSpan = (LON_MAX - LON_MIN) * LON_SCALE;
  const x = ((lon - LON_MIN) * LON_SCALE) / lonSpan * width;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * height;
  return [x, y];
}

export interface City {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

/** The six basket airports. */
export const CITIES: Record<string, City> = {
  DEL: { code: "DEL", name: "Delhi", lat: 28.56, lon: 77.1 },
  BOM: { code: "BOM", name: "Mumbai", lat: 19.09, lon: 72.87 },
  BLR: { code: "BLR", name: "Bengaluru", lat: 13.2, lon: 77.71 },
  CCU: { code: "CCU", name: "Kolkata", lat: 22.65, lon: 88.45 },
  HYD: { code: "HYD", name: "Hyderabad", lat: 17.24, lon: 78.43 },
  MAA: { code: "MAA", name: "Chennai", lat: 13.0, lon: 80.17 },
};

/**
 * A ~40-point simplified outline of mainland India (lon, lat), clockwise from
 * the north-west. Deliberately schematic — recognisable, not survey-accurate.
 */
export const INDIA_OUTLINE: [number, number][] = [
  [74.0, 34.6],
  [77.8, 35.5],
  [78.9, 34.3],
  [79.2, 32.5],
  [81.0, 30.3],
  [83.5, 29.2],
  [88.2, 27.9],
  [89.7, 26.7],
  [92.0, 27.6],
  [95.5, 28.1],
  [97.3, 28.2],
  [96.6, 27.2],
  [97.0, 25.4],
  [95.2, 24.0],
  [94.5, 22.0],
  [93.4, 21.0],
  [92.6, 22.1],
  [91.5, 22.9],
  [89.0, 22.0],
  [88.0, 21.5],
  [86.5, 20.1],
  [85.0, 19.5],
  [82.2, 16.9],
  [80.3, 15.9],
  [80.1, 13.0],
  [79.9, 11.8],
  [79.3, 10.3],
  [77.5, 8.1],
  [76.5, 8.9],
  [75.0, 12.0],
  [74.5, 14.8],
  [73.5, 15.9],
  [72.9, 19.1],
  [72.6, 21.3],
  [70.0, 20.9],
  [69.0, 22.2],
  [68.2, 23.7],
  [70.0, 24.3],
  [71.0, 24.7],
  [73.0, 28.0],
  [74.5, 31.0],
  [75.4, 32.5],
  [74.0, 34.6],
];

/** Build an SVG path `d` string for the India outline in a `width` x `height` box. */
export function indiaOutlinePath(width: number, height: number): string {
  return (
    INDIA_OUTLINE.map(([lon, lat], i) => {
      const [x, y] = projectLatLng(lat, lon, width, height);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ") + " Z"
  );
}
