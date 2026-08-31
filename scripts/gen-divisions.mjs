/**
 * Generate prisma/data/rw-divisions.json — the full Rwanda administrative tree
 * (Province → District → Sector → Cell) that prisma/seed-reference.ts ingests
 * for the CV location autocomplete. Sourced from the `rwanda-geo` dataset
 * (5 provinces, 30 districts, 416 sectors, 2148 cells).
 *
 * Re-run after a `rwanda-geo` bump:  node scripts/gen-divisions.mjs
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const geo = require('rwanda-geo');

const out = { provinces: [] };

const provinces = await geo.getAllProvinces();
for (const p of provinces) {
  const pNode = { name: p.name, districts: [] };
  for (const d of await geo.getDistrictsByProvince(p.code)) {
    const dNode = { name: d.name, sectors: [] };
    for (const s of await geo.getSectorsByDistrict(d.code)) {
      const cells = await geo.getCellsBySector(s.code);
      dNode.sectors.push({ name: s.name, cells: cells.map((c) => c.name) });
    }
    pNode.districts.push(dNode);
  }
  out.provinces.push(pNode);
}

mkdirSync(join('prisma', 'data'), { recursive: true });
writeFileSync(join('prisma', 'data', 'rw-divisions.json'), JSON.stringify(out, null, 2) + '\n');

const districts = out.provinces.flatMap((p) => p.districts);
const sectors = districts.flatMap((d) => d.sectors);
const cells = sectors.flatMap((s) => s.cells);
console.log(
  `✅ rw-divisions.json — ${out.provinces.length} provinces, ${districts.length} districts, ${sectors.length} sectors, ${cells.length} cells`
);
