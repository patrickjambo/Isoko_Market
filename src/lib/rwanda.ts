/**
 * Rwanda administrative divisions (30 districts) for the location autocomplete
 * (Section 3, Step 5) — real admin data, not placeholders, so search filtering
 * stays accurate. Prefixed with the City of Kigali sectors for convenience.
 */
export const RWANDA_DISTRICTS: string[] = [
  'Kigali, Nyarugenge',
  'Kigali, Gasabo',
  'Kigali, Kicukiro',
  'Musanze',
  'Rubavu',
  'Huye',
  'Muhanga',
  'Nyagatare',
  'Rwamagana',
  'Kayonza',
  'Ngoma',
  'Kirehe',
  'Bugesera',
  'Gatsibo',
  'Nyanza',
  'Ruhango',
  'Kamonyi',
  'Gisagara',
  'Nyaruguru',
  'Nyamagabe',
  'Karongi',
  'Rutsiro',
  'Ngororero',
  'Nyabihu',
  'Rusizi',
  'Nyamasheke',
  'Burera',
  'Gakenke',
  'Gicumbi',
  'Rulindo',
];

/**
 * Schematic (non-geographic) positions for the district "map" view — normalized
 * 0–100 (x: west→east, y: north→south). Deliberately approximate: we only ever
 * show district-level location for privacy (Section 3), never exact addresses,
 * and this keeps the map dependency-free and low-bandwidth.
 */
export const RWANDA_DISTRICT_POS: { name: string; x: number; y: number }[] = [
  { name: 'Nyarugenge', x: 52, y: 48 },
  { name: 'Gasabo', x: 56, y: 43 },
  { name: 'Kicukiro', x: 57, y: 52 },
  { name: 'Musanze', x: 42, y: 20 },
  { name: 'Burera', x: 52, y: 14 },
  { name: 'Gakenke', x: 44, y: 30 },
  { name: 'Gicumbi', x: 59, y: 24 },
  { name: 'Rulindo', x: 50, y: 34 },
  { name: 'Rubavu', x: 24, y: 26 },
  { name: 'Nyabihu', x: 31, y: 31 },
  { name: 'Ngororero', x: 35, y: 42 },
  { name: 'Rutsiro', x: 27, y: 39 },
  { name: 'Karongi', x: 28, y: 51 },
  { name: 'Nyamasheke', x: 22, y: 63 },
  { name: 'Rusizi', x: 17, y: 73 },
  { name: 'Nyamagabe', x: 38, y: 62 },
  { name: 'Nyaruguru', x: 42, y: 76 },
  { name: 'Huye', x: 48, y: 68 },
  { name: 'Gisagara', x: 55, y: 73 },
  { name: 'Nyanza', x: 48, y: 58 },
  { name: 'Ruhango', x: 46, y: 52 },
  { name: 'Muhanga', x: 44, y: 46 },
  { name: 'Kamonyi', x: 50, y: 50 },
  { name: 'Bugesera', x: 60, y: 61 },
  { name: 'Rwamagana', x: 67, y: 48 },
  { name: 'Kayonza', x: 74, y: 42 },
  { name: 'Ngoma', x: 71, y: 59 },
  { name: 'Kirehe', x: 80, y: 63 },
  { name: 'Gatsibo', x: 73, y: 32 },
  { name: 'Nyagatare', x: 80, y: 19 },
];

/**
 * Approximate real lat/lng centroids per district — so listings that only have a
 * text location (no dropped pin) can still appear on the marketplace map at their
 * district. District-level only, by design (privacy — never an exact address).
 */
const DISTRICT_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  nyarugenge: { lat: -1.9536, lng: 30.0606 },
  gasabo: { lat: -1.93, lng: 30.13 },
  kicukiro: { lat: -1.985, lng: 30.105 },
  musanze: { lat: -1.4998, lng: 29.6339 },
  burera: { lat: -1.47, lng: 29.89 },
  gakenke: { lat: -1.69, lng: 29.78 },
  gicumbi: { lat: -1.58, lng: 30.11 },
  rulindo: { lat: -1.77, lng: 30.06 },
  rubavu: { lat: -1.6777, lng: 29.26 },
  nyabihu: { lat: -1.65, lng: 29.51 },
  ngororero: { lat: -1.87, lng: 29.62 },
  rutsiro: { lat: -1.93, lng: 29.33 },
  karongi: { lat: -2.0, lng: 29.38 },
  nyamasheke: { lat: -2.35, lng: 29.14 },
  rusizi: { lat: -2.48, lng: 28.91 },
  nyamagabe: { lat: -2.47, lng: 29.42 },
  nyaruguru: { lat: -2.66, lng: 29.52 },
  huye: { lat: -2.596, lng: 29.739 },
  gisagara: { lat: -2.63, lng: 29.83 },
  nyanza: { lat: -2.35, lng: 29.75 },
  ruhango: { lat: -2.23, lng: 29.78 },
  muhanga: { lat: -2.08, lng: 29.75 },
  kamonyi: { lat: -2.0, lng: 29.9 },
  bugesera: { lat: -2.21, lng: 30.13 },
  rwamagana: { lat: -1.949, lng: 30.434 },
  kayonza: { lat: -1.88, lng: 30.62 },
  ngoma: { lat: -2.15, lng: 30.53 },
  kirehe: { lat: -2.22, lng: 30.71 },
  gatsibo: { lat: -1.58, lng: 30.45 },
  nyagatare: { lat: -1.29, lng: 30.33 },
};

// Checked only after the districts above, so "Kigali, Nyarugenge" resolves to
// Nyarugenge, not the generic Kigali point.
const REGION_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  kigali: { lat: -1.9536, lng: 30.0606 },
  eastern: { lat: -1.9, lng: 30.55 },
  western: { lat: -2.0, lng: 29.3 },
  northern: { lat: -1.55, lng: 29.9 },
  southern: { lat: -2.4, lng: 29.7 },
};

/**
 * Best-effort centroid for a free-text location ("Kigali, Nyarugenge", "Musanze",
 * "Gasabo, Kigali City, Rwanda"…). Returns null if nothing matches. Used as a map
 * fallback when a listing has no precise lat/lng.
 */
export function districtCentroid(
  location: string | null | undefined
): { lat: number; lng: number } | null {
  if (!location) return null;
  const loc = location.toLowerCase();
  for (const [name, c] of Object.entries(DISTRICT_CENTROIDS)) if (loc.includes(name)) return c;
  for (const [name, c] of Object.entries(REGION_CENTROIDS)) if (loc.includes(name)) return c;
  return null;
}
