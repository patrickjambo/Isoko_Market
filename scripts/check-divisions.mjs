#!/usr/bin/env node
/**
 * Administrative-division completeness gate (CV Builder correction, point 4).
 *
 * Rwanda's official structure: 5 provinces → 30 districts → 416 sectors →
 * 2,148 cells. Location autocomplete must work identically for a user in
 * Musanze or Huye as in Kigali, so this asserts national completeness and
 * FAILS LOUDLY (exit 1) with a per-province breakdown if the seed is partial —
 * rather than silently shipping ~90% missing coverage.
 *
 * Districts are a hard gate (30). Sectors/cells default to a WARNING unless
 * STRICT_DIVISIONS=1, because the verified NISR/MINALOC export must be supplied
 * as prisma/data/rw-divisions.json — see prisma/seed-reference.ts. Set
 * STRICT_DIVISIONS=1 in CI once that file is in place to make them hard gates.
 */
import { PrismaClient } from '@prisma/client';

const TARGET = { provinces: 5, districts: 30, sectors: 416, cells: 2148 };
const STRICT = process.env.STRICT_DIVISIONS === '1';

const prisma = new PrismaClient();
try {
  const [provinces, districts, sectors, cells] = await Promise.all([
    prisma.adminDivision.count({ where: { level: 'province' } }),
    prisma.adminDivision.count({ where: { level: 'district' } }),
    prisma.adminDivision.count({ where: { level: 'sector' } }),
    prisma.adminDivision.count({ where: { level: 'cell' } }),
  ]);

  const provs = await prisma.adminDivision.findMany({
    where: { level: 'province' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  console.log('Per-province coverage:');
  for (const p of provs) {
    const ds = await prisma.adminDivision.findMany({ where: { level: 'district', parentId: p.id }, select: { id: true } });
    let sec = 0;
    for (const d of ds) sec += await prisma.adminDivision.count({ where: { level: 'sector', parentId: d.id } });
    const flag = sec === 0 ? '  ❌ no sectors' : '';
    console.log(`  ${p.name.padEnd(18)} districts=${String(ds.length).padStart(2)}  sectors=${String(sec).padStart(3)}${flag}`);
  }

  const line = (label, got, want, hard) => {
    const ok = got === want;
    const mark = ok ? '✅' : hard ? '❌' : '⚠️ ';
    console.log(`${mark} ${label}: ${got} / ${want}${ok ? '' : `  (${want - got} missing)`}`);
    return ok;
  };

  console.log('\n— Division completeness —');
  const okP = line('Provinces', provinces, TARGET.provinces, true);
  const okD = line('Districts', districts, TARGET.districts, true);
  const okS = line('Sectors', sectors, TARGET.sectors, STRICT);
  const okC = line('Cells', cells, TARGET.cells, STRICT);

  const hardOk = okP && okD && (STRICT ? okS && okC : true);
  if (hardOk) {
    if (!(okS && okC)) {
      console.log(
        '\n⚠️  Districts complete, but sectors/cells are partial. Provide the verified\n' +
          '   NISR/MINALOC export at prisma/data/rw-divisions.json for full national\n' +
          '   coverage, then run `npm run db:seed:reference`. (Set STRICT_DIVISIONS=1 to hard-fail.)'
      );
    } else {
      console.log('\n✓ Full national division coverage.');
    }
    process.exit(0);
  }
  console.error('\n✗ Division coverage is incomplete — see the missing counts above.');
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
