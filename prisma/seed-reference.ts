/**
 * CV Builder reference data (Institutions, Faculties, Combinations, Admin
 * divisions). Seeded, autocomplete-backed, single-source (Rule 1).
 *
 * ⚠️ DATA-INTEGRITY NOTE: these lists were compiled from general knowledge, NOT
 * verified live against the official REB / HEC / NISR-MINALOC registries. They
 * are intentionally REPRESENTATIVE, not authoritative:
 *   • Provinces (5) + Districts (30): complete and reliable.
 *   • Sectors: Kigali City only. Other provinces rely on the "add new" fallback.
 *   • Cells: not seeded (add-new fallback) — the official tree is ~2,148 cells.
 *   • Combinations / Universities / Secondary schools: common entries only.
 * Every autocomplete has an "Institution/combination not listed? add it" path
 * that writes an isVerifiedSource=false row for admin review, so incomplete
 * coverage never blocks a user (spec Part 2). Counts are logged at the end.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';

type Tri = { rw: string; en: string; fr: string };

/**
 * Optional OFFICIAL national divisions file. Drop the verified NISR/MINALOC
 * export here to get full Province→District→Sector→Cell coverage; the seed
 * ingests it verbatim. Shape:
 *   { "provinces": [ { "name": "...",
 *       "districts": [ { "name": "...",
 *         "sectors": [ { "name": "...", "cells": ["...", ...] } ] } ] } ] }
 * Absent → the built-in fallback (all 30 districts + Kigali sectors) is used and
 * the completeness check (`npm run check:divisions`) fails loudly on sectors.
 */
const DIVISIONS_FILE = join(process.cwd(), 'prisma', 'data', 'rw-divisions.json');
type DivisionsFile = {
  provinces: { name: string; districts: { name: string; sectors?: { name: string; cells?: string[] }[] }[] }[];
};
function loadDivisionsFile(): DivisionsFile | null {
  if (!existsSync(DIVISIONS_FILE)) return null;
  try {
    const parsed = JSON.parse(readFileSync(DIVISIONS_FILE, 'utf8')) as DivisionsFile;
    if (Array.isArray(parsed?.provinces) && parsed.provinces.length > 0) return parsed;
  } catch {
    /* fall through to fallback */
  }
  return null;
}

// ── Administrative divisions (Province → District → [Kigali sectors]) ──────────
const PROVINCES: Record<string, string[]> = {
  'Kigali City': ['Nyarugenge', 'Gasabo', 'Kicukiro'],
  'Southern Province': ['Nyanza', 'Gisagara', 'Nyaruguru', 'Huye', 'Nyamagabe', 'Ruhango', 'Muhanga', 'Kamonyi'],
  'Western Province': ['Karongi', 'Rutsiro', 'Rubavu', 'Nyabihu', 'Ngororero', 'Rusizi', 'Nyamasheke'],
  'Northern Province': ['Rulindo', 'Gakenke', 'Musanze', 'Burera', 'Gicumbi'],
  'Eastern Province': ['Rwamagana', 'Nyagatare', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Bugesera'],
};

// Sectors — Kigali City districts only (reliable). Elsewhere: add-new fallback.
const KIGALI_SECTORS: Record<string, string[]> = {
  Nyarugenge: ['Gitega', 'Kanyinya', 'Kigali', 'Kimisagara', 'Mageragere', 'Muhima', 'Nyakabanda', 'Nyamirambo', 'Nyarugenge', 'Rwezamenyo'],
  Gasabo: ['Bumbogo', 'Gatsata', 'Gikomero', 'Gisozi', 'Jabana', 'Jali', 'Kacyiru', 'Kimihurura', 'Kimironko', 'Kinyinya', 'Ndera', 'Nduba', 'Remera', 'Rusororo', 'Rutunga'],
  Kicukiro: ['Gahanga', 'Gatenga', 'Gikondo', 'Kagarama', 'Kanombe', 'Kicukiro', 'Kigarama', 'Masaka', 'Niboye', 'Nyarugunga'],
};

// ── REB A-level combinations (common; verify against current REB list) ─────────
const COMBINATIONS: { code: string; kind: 'alevel' | 'tvet'; name: Tri }[] = [
  { code: 'MPC', kind: 'alevel', name: { en: 'Mathematics – Physics – Computer Science', fr: 'Mathématiques – Physique – Informatique', rw: 'Imibare – Fizike – Mudasobwa' } },
  { code: 'MCB', kind: 'alevel', name: { en: 'Mathematics – Chemistry – Biology', fr: 'Mathématiques – Chimie – Biologie', rw: 'Imibare – Shimi – Ibinyabuzima' } },
  { code: 'MPG', kind: 'alevel', name: { en: 'Mathematics – Physics – Geography', fr: 'Mathématiques – Physique – Géographie', rw: 'Imibare – Fizike – Geografiya' } },
  { code: 'PCB', kind: 'alevel', name: { en: 'Physics – Chemistry – Biology', fr: 'Physique – Chimie – Biologie', rw: 'Fizike – Shimi – Ibinyabuzima' } },
  { code: 'PCM', kind: 'alevel', name: { en: 'Physics – Chemistry – Mathematics', fr: 'Physique – Chimie – Mathématiques', rw: 'Fizike – Shimi – Imibare' } },
  { code: 'BCG', kind: 'alevel', name: { en: 'Biology – Chemistry – Geography', fr: 'Biologie – Chimie – Géographie', rw: 'Ibinyabuzima – Shimi – Geografiya' } },
  { code: 'MEG', kind: 'alevel', name: { en: 'Mathematics – Economics – Geography', fr: 'Mathématiques – Économie – Géographie', rw: 'Imibare – Ubukungu – Geografiya' } },
  { code: 'HEG', kind: 'alevel', name: { en: 'History – Economics – Geography', fr: 'Histoire – Économie – Géographie', rw: 'Amateka – Ubukungu – Geografiya' } },
  { code: 'HGL', kind: 'alevel', name: { en: 'History – Geography – Literature', fr: 'Histoire – Géographie – Littérature', rw: 'Amateka – Geografiya – Ubuvanganzo' } },
  { code: 'LFK', kind: 'alevel', name: { en: 'Literature – French – Kinyarwanda', fr: 'Littérature – Français – Kinyarwanda', rw: 'Ubuvanganzo – Igifaransa – Ikinyarwanda' } },
  { code: 'LEK', kind: 'alevel', name: { en: 'Literature – English – Kinyarwanda', fr: 'Littérature – Anglais – Kinyarwanda', rw: 'Ubuvanganzo – Icyongereza – Ikinyarwanda' } },
  { code: 'MPB', kind: 'alevel', name: { en: 'Mathematics – Physics – Biology', fr: 'Mathématiques – Physique – Biologie', rw: 'Imibare – Fizike – Ibinyabuzima' } },
  // TVET trades (reuse Combination table, kind=tvet).
  { code: 'TVET-SOD', kind: 'tvet', name: { en: 'Software Development', fr: 'Développement logiciel', rw: 'Gukora porogaramu za mudasobwa' } },
  { code: 'TVET-ELN', kind: 'tvet', name: { en: 'Electronics & Telecommunication', fr: 'Électronique & Télécommunication', rw: 'Elegitoronike na Itumanaho' } },
  { code: 'TVET-BLD', kind: 'tvet', name: { en: 'Building Construction', fr: 'Construction de bâtiments', rw: 'Ubwubatsi' } },
  { code: 'TVET-ATE', kind: 'tvet', name: { en: 'Automobile Technology', fr: 'Technologie automobile', rw: 'Ikoranabuhanga mu modoka' } },
  { code: 'TVET-CUL', kind: 'tvet', name: { en: 'Culinary Arts / Food & Beverage', fr: 'Arts culinaires', rw: 'Guteka no gutegura ibiryo' } },
  { code: 'TVET-TDM', kind: 'tvet', name: { en: 'Tailoring & Fashion Design', fr: 'Couture & Mode', rw: 'Kudoda no gushushanya imyenda' } },
];

// ── Universities (HEC — common; not exhaustive) with faculties/colleges ───────
const UNIVERSITIES: { name: string; district?: string; faculties: Tri[] }[] = [
  {
    name: 'University of Rwanda (UR)',
    district: 'Gasabo',
    faculties: [
      { en: 'College of Science and Technology', fr: 'Collège des Sciences et Technologies', rw: 'Ishuri Rikuru ry’Ubumenyi n’Ikoranabuhanga' },
      { en: 'College of Business and Economics', fr: 'Collège de Commerce et Économie', rw: 'Ishuri Rikuru ry’Ubucuruzi n’Ubukungu' },
      { en: 'College of Medicine and Health Sciences', fr: 'Collège de Médecine et Sciences de la Santé', rw: 'Ishuri Rikuru rya Kaminuza y’Ubuvuzi' },
      { en: 'College of Education', fr: 'Collège de l’Éducation', rw: 'Ishuri Rikuru ry’Uburezi' },
      { en: 'College of Arts and Social Sciences', fr: 'Collège des Arts et Sciences Sociales', rw: 'Ishuri Rikuru ry’Ubugeni n’Imibanire y’Abantu' },
      { en: 'College of Agriculture, Animal Sciences and Veterinary Medicine', fr: 'Collège d’Agriculture et Médecine Vétérinaire', rw: 'Ishuri Rikuru ry’Ubuhinzi n’Ubworozi' },
    ],
  },
  { name: 'Adventist University of Central Africa (AUCA)', district: 'Gasabo', faculties: [{ en: 'Information Technology', fr: 'Technologies de l’information', rw: 'Ikoranabuhanga' }, { en: 'Business Administration', fr: 'Administration des affaires', rw: 'Ubuyobozi bw’ubucuruzi' }, { en: 'Theology', fr: 'Théologie', rw: 'Iyobokamana' }] },
  { name: 'Mount Kenya University Rwanda (MKUR)', district: 'Kicukiro', faculties: [{ en: 'Business & Economics', fr: 'Commerce & Économie', rw: 'Ubucuruzi n’Ubukungu' }, { en: 'Education', fr: 'Éducation', rw: 'Uburezi' }, { en: 'Public Health', fr: 'Santé publique', rw: 'Ubuzima rusange' }] },
  { name: 'University of Kigali (UoK)', district: 'Kicukiro', faculties: [{ en: 'Business Administration', fr: 'Administration des affaires', rw: 'Ubuyobozi bw’ubucuruzi' }, { en: 'Law', fr: 'Droit', rw: 'Amategeko' }] },
  { name: 'INES-Ruhengeri', district: 'Musanze', faculties: [{ en: 'Applied Sciences', fr: 'Sciences appliquées', rw: 'Ubumenyi bushyirwa mu bikorwa' }, { en: 'Economics & Management', fr: 'Économie & Gestion', rw: 'Ubukungu n’Imicungire' }] },
  { name: 'Kigali Independent University (ULK)', district: 'Gasabo', faculties: [{ en: 'Law', fr: 'Droit', rw: 'Amategeko' }, { en: 'Economics & Management', fr: 'Économie & Gestion', rw: 'Ubukungu n’Imicungire' }] },
  { name: 'African Leadership University (ALU)', district: 'Kicukiro', faculties: [{ en: 'Computer Science', fr: 'Informatique', rw: 'Ubumenyi bwa mudasobwa' }, { en: 'Global Challenges', fr: 'Défis mondiaux', rw: 'Imbogamizi z’isi' }, { en: 'Entrepreneurship', fr: 'Entrepreneuriat', rw: 'Ubucuruzi' }] },
  { name: 'Kepler', district: 'Gasabo', faculties: [{ en: 'Business Analytics', fr: 'Analytique d’affaires', rw: 'Isesengura ry’ubucuruzi' }, { en: 'Project Management', fr: 'Gestion de projet', rw: 'Imicungire y’imishinga' }] },
  { name: 'Carnegie Mellon University Africa (CMU-Africa)', district: 'Gasabo', faculties: [{ en: 'Electrical & Computer Engineering', fr: 'Génie électrique et informatique', rw: 'Ubwubatsi bw’amashanyarazi na mudasobwa' }, { en: 'Information Technology', fr: 'Technologies de l’information', rw: 'Ikoranabuhanga' }] },
  { name: 'University of Global Health Equity (UGHE)', district: 'Burera', faculties: [{ en: 'Medicine', fr: 'Médecine', rw: 'Ubuvuzi' }, { en: 'Global Health Delivery', fr: 'Prestation de santé mondiale', rw: 'Serivisi z’ubuzima ku isi' }] },
  { name: 'Rwanda Polytechnic (RP / IPRC)', district: 'Kicukiro', faculties: [{ en: 'Information & Communication Technology', fr: 'TIC', rw: 'Ikoranabuhanga mu itumanaho' }, { en: 'Civil Engineering', fr: 'Génie civil', rw: 'Ubwubatsi' }, { en: 'Mechanical Engineering', fr: 'Génie mécanique', rw: 'Ubumekaniki' }] },
  { name: 'Protestant University of Rwanda (PUR)', district: 'Huye', faculties: [{ en: 'Theology', fr: 'Théologie', rw: 'Iyobokamana' }, { en: 'Development Studies', fr: 'Études du développement', rw: 'Iby’iterambere' }] },
  { name: 'University of Tourism, Technology and Business Studies (UTB)', district: 'Gasabo', faculties: [{ en: 'Tourism & Hospitality', fr: 'Tourisme & Hôtellerie', rw: 'Ubukerarugendo n’Ubwakiranyi' }, { en: 'Business Studies', fr: 'Études commerciales', rw: 'Ubucuruzi' }] },
];

// ── A small sample of well-known secondary schools (rely on add-new elsewhere) ─
const SECONDARY_SCHOOLS: { name: string; district?: string }[] = [
  { name: 'FAWE Girls School', district: 'Gasabo' },
  { name: 'Green Hills Academy', district: 'Gasabo' },
  { name: 'Lycée de Kigali', district: 'Nyarugenge' },
  { name: 'Riviera High School', district: 'Gasabo' },
  { name: 'Groupe Scolaire Officiel de Butare', district: 'Huye' },
  { name: 'Ecole des Sciences de Byimana', district: 'Ruhango' },
  { name: 'Groupe Scolaire Notre Dame de Cîteaux', district: 'Nyarugenge' },
  { name: 'College Saint André', district: 'Nyarugenge' },
  { name: 'GS Nyanza (Ecole Notre-Dame de la Providence Karubanda)', district: 'Huye' },
  { name: 'King David Academy', district: 'Kicukiro' },
  { name: 'Petit Séminaire Saint Léon Kabgayi', district: 'Muhanga' },
  { name: 'Ecole Technique Saint Joseph Kabgayi', district: 'Muhanga' },
];

export async function seedReference(prisma: PrismaClient) {
  // Production BOOTSTRAP mode (SEED_IF_EMPTY=1, used by vercel-build): only seed
  // when the tables are empty, so a redeploy never wipes divisions/institutions
  // that live CVs already reference. Dev (`npm run db:seed:reference`) runs the
  // full destructive re-seed below so data edits always take effect.
  if (process.env.SEED_IF_EMPTY === '1') {
    const [divs, insts] = await Promise.all([
      prisma.adminDivision.count(),
      prisma.institution.count(),
    ]);
    if (divs > 0 && insts > 0) {
      console.log(`↩︎  Reference data already present (${divs} divisions, ${insts} institutions) — skipping.`);
      return { skipped: true };
    }
  }

  // Idempotent: clear reference tables first (respect FK order).
  await prisma.faculty.deleteMany();
  await prisma.combination.deleteMany();
  await prisma.institution.deleteMany();
  // Detach any CV.locationId before clearing divisions, then clear children→parents.
  await prisma.cV.updateMany({ where: { locationId: { not: null } }, data: { locationId: null } });
  await prisma.adminDivision.deleteMany({ where: { level: 'cell' } });
  await prisma.adminDivision.deleteMany({ where: { level: 'sector' } });
  await prisma.adminDivision.deleteMany({ where: { level: 'district' } });
  await prisma.adminDivision.deleteMany({ where: { level: 'province' } });

  // Divisions — from the official file if present, else the built-in fallback.
  const file = loadDivisionsFile();
  let provinceCount = 0, districtCount = 0, sectorCount = 0, cellCount = 0;
  const divisionSource = file ? 'official file (prisma/data/rw-divisions.json)' : 'built-in fallback';

  if (file) {
    for (const prov of file.provinces) {
      const p = await prisma.adminDivision.create({ data: { level: 'province', name: prov.name } });
      provinceCount++;
      for (const dist of prov.districts) {
        const d = await prisma.adminDivision.create({ data: { level: 'district', name: dist.name, parentId: p.id } });
        districtCount++;
        for (const sec of dist.sectors ?? []) {
          const s = await prisma.adminDivision.create({ data: { level: 'sector', name: sec.name, parentId: d.id } });
          sectorCount++;
          for (const cell of sec.cells ?? []) {
            await prisma.adminDivision.create({ data: { level: 'cell', name: cell, parentId: s.id } });
            cellCount++;
          }
        }
      }
    }
  } else {
    for (const [province, districts] of Object.entries(PROVINCES)) {
      const p = await prisma.adminDivision.create({ data: { level: 'province', name: province } });
      provinceCount++;
      for (const district of districts) {
        const d = await prisma.adminDivision.create({ data: { level: 'district', name: district, parentId: p.id } });
        districtCount++;
        for (const sector of KIGALI_SECTORS[district] ?? []) {
          await prisma.adminDivision.create({ data: { level: 'sector', name: sector, parentId: d.id } });
          sectorCount++;
        }
      }
    }
  }

  // Combinations.
  await prisma.combination.createMany({
    data: COMBINATIONS.map((c) => ({ code: c.code, kind: c.kind, name: c.name as unknown as Prisma.InputJsonValue })),
  });

  // Universities + faculties.
  let facultyCount = 0;
  for (const u of UNIVERSITIES) {
    const inst = await prisma.institution.create({
      data: { name: u.name, type: 'university', district: u.district ?? null, isVerifiedSource: true },
    });
    for (const f of u.faculties) {
      await prisma.faculty.create({ data: { institutionId: inst.id, name: f as unknown as Prisma.InputJsonValue } });
      facultyCount++;
    }
  }

  // Secondary schools.
  await prisma.institution.createMany({
    data: SECONDARY_SCHOOLS.map((s) => ({ name: s.name, type: 'secondary_school', district: s.district ?? null, isVerifiedSource: true })),
  });

  const counts = {
    provinces: provinceCount,
    districts: districtCount,
    sectors: sectorCount,
    cells: cellCount,
    combinations: COMBINATIONS.length,
    universities: UNIVERSITIES.length,
    faculties: facultyCount,
    secondarySchools: SECONDARY_SCHOOLS.length,
  };
  console.log(`   🎓 Reference data seeded (divisions from: ${divisionSource}):`, counts);
  if (!file) {
    console.log('   ⚠️  Divisions: districts complete (30), but SECTORS = Kigali only and CELLS = none.');
    console.log('      → Provide prisma/data/rw-divisions.json (verified NISR/MINALOC export) for full');
    console.log('        national coverage. `npm run check:divisions` enforces 30/416/2148.');
  }
  return counts;
}

// Standalone runner: `tsx prisma/seed-reference.ts`
if (process.argv[1] && process.argv[1].endsWith('seed-reference.ts')) {
  const prisma = new PrismaClient();
  seedReference(prisma)
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
