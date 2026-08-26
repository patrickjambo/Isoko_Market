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
