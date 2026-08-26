import 'server-only';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { CvData } from './validators/cv';
import { labelForSkill } from './skills';
import { formatEducation, sortEducation, formatLanguages, type EduLabels } from './cv-format';

const TEAL = rgb(0.06, 0.4, 0.36);
const ORANGE = rgb(0.98, 0.45, 0.09);
const INK = rgb(0.1, 0.14, 0.15);
const GREY = rgb(0.42, 0.46, 0.47);

export type CvPdfLabels = {
  sections: {
    profile: string;
    experience: string;
    education: string;
    skills: string;
    languages: string;
    certifications: string;
    references: string;
  };
  edu: EduLabels;
  lang: (code: string) => string;
  proficiency: (level: string) => string;
  present: string;
  dob: string;
  license: string;
};

/**
 * Render a structured CV into a clean, professional single-column A4 PDF
 * (spec Part 9). Pure JS (pdf-lib) — no headless browser. Education is
 * formatted with the SAME shared formatter as the on-screen preview so they
 * never drift, most-recent-first; certificates are referenced, not embedded.
 */
export async function generateCvPdf(input: {
  fullName: string;
  phone?: string;
  location?: string;
  locale: string;
  data: CvData;
  labels: CvPdfLabels;
}): Promise<Uint8Array> {
  const { data, labels, locale } = input;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595.28, 841.89]); // A4
  const margin = 48;
  const width = page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < margin) {
      page = doc.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
    }
  };
  const wrap = (text: string, f: PDFFont, size: number, maxWidth: number): string[] => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(test, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };
  const drawText = (text: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    for (const line of wrap(text, f, size, width)) {
      newPageIfNeeded(size + 4);
      page.drawText(line, { x: margin, y, size, font: f, color: opts.color ?? INK });
      y -= size + 3;
    }
    y -= opts.gap ?? 0;
  };
  const sectionHeading = (label: string) => {
    y -= 10;
    newPageIfNeeded(24);
    page.drawText(label.toUpperCase(), { x: margin, y, size: 11, font: bold, color: TEAL });
    y -= 6;
    page.drawRectangle({ x: margin, y, width, height: 1.4, color: ORANGE });
    y -= 12;
  };
  // Right-aligned period text on the current line.
  const drawPeriod = (period: string) => {
    if (!period) return;
    const pw = font.widthOfTextAtSize(period, 9.5);
    page.drawText(period, { x: margin + width - pw, y, size: 9.5, font, color: GREY });
  };

  // ── Header: name, headline, compact contact line ──
  page.drawText(input.fullName, { x: margin, y, size: 22, font: bold, color: INK });
  y -= 26;
  if (data.headline) {
    page.drawText(data.headline, { x: margin, y, size: 12, font, color: ORANGE });
    y -= 16;
  }
  const langLine = formatLanguages(data.languages, { lang: labels.lang, level: labels.proficiency });
  const contactBits = [input.phone, data.contactEmail, input.location, data.portfolioUrl, langLine]
    .filter(Boolean)
    .join('   •   ');
  if (contactBits) {
    for (const line of wrap(contactBits, font, 9.5, width)) {
      page.drawText(line, { x: margin, y, size: 9.5, font, color: GREY });
      y -= 12;
    }
  }
  const personalBits = [
    data.dateOfBirth && `${labels.dob}: ${data.dateOfBirth}`,
    data.nationality,
    data.drivingLicense && `${labels.license}: ${data.drivingLicense}`,
  ]
    .filter(Boolean)
    .join('   •   ');
  if (personalBits) {
    page.drawText(personalBits, { x: margin, y, size: 9, font, color: GREY });
    y -= 12;
  }
  y -= 4;
  page.drawRectangle({ x: margin, y, width, height: 1, color: rgb(0.85, 0.87, 0.87) });
  y -= 6;

  if (data.summary) {
    sectionHeading(labels.sections.profile);
    drawText(data.summary, { size: 10, gap: 4 });
  }

  if (data.experience.length) {
    sectionHeading(labels.sections.experience);
    for (const e of data.experience) {
      newPageIfNeeded(30);
      page.drawText(e.position || e.company, { x: margin, y, size: 11, font: bold, color: INK });
      drawPeriod([e.startYear, e.endYear].filter(Boolean).join(' – '));
      y -= 14;
      if (e.position && e.company) drawText(e.company, { size: 9.5, color: GREY });
      if (e.summary) drawText(e.summary, { size: 10, gap: 4 });
    }
  }

  if (data.education.length) {
    sectionHeading(labels.sections.education);
    for (const ed of sortEducation(data.education)) {
      const f = formatEducation(ed, labels.edu);
      newPageIfNeeded(28);
      page.drawText(f.title, { x: margin, y, size: 11, font: bold, color: INK });
      drawPeriod(f.years);
      y -= 14;
      const line2 = [f.institution, f.classification].filter(Boolean).join(' — ');
      if (line2) drawText(line2, { size: 9.5, color: GREY, gap: 2 });
    }
  }

  if (data.skills.length) {
    sectionHeading(labels.sections.skills);
    drawText(data.skills.map((k) => labelForSkill(k, locale)).join('   ·   '), { size: 10, gap: 4 });
  }

  if (langLine) {
    sectionHeading(labels.sections.languages);
    drawText(langLine, { size: 10 });
  }

  if (data.certifications.length) {
    sectionHeading(labels.sections.certifications);
    for (const c of data.certifications) {
      const detail = [c.issuer, c.year].filter(Boolean).join(', ');
      drawText(detail ? `${c.name} — ${detail}` : c.name, { size: 10 });
    }
  }

  if (data.references.length) {
    sectionHeading(labels.sections.references);
    for (const r of data.references) {
      const detail = [r.relationship, r.phone, r.email].filter(Boolean).join(' · ');
      drawText(detail ? `${r.name} — ${detail}` : r.name, { size: 10 });
    }
  }

  drawFooter(page, font);
  return doc.save();
}

function drawFooter(page: PDFPage, font: PDFFont) {
  page.drawText('Generated with Isoko Market', { x: 48, y: 28, size: 8, font, color: GREY });
}

/**
 * Build the label pack for {@link generateCvPdf} from a `cv`-namespace translator
 * (`getTranslations('cv')`). Shared by the seeker's own download and the
 * employer's applicant-CV download so both render identically (Rule 3).
 */
export function cvPdfLabels(t: (key: string) => string): CvPdfLabels {
  return {
    sections: {
      profile: t('summary'),
      experience: t('experience'),
      education: t('education'),
      skills: t('skills'),
      languages: t('languages'),
      certifications: t('certificate'),
      references: t('references'),
    },
    edu: {
      level: (l) => t(`eduLevel_${l}`),
      degree: (d) => t(`degree_${d}`),
      inWord: t('inWord'),
      present: t('present'),
    },
    lang: (c) => (['rw', 'en', 'fr'].includes(c) ? t(`lang_${c}`) : c),
    proficiency: (lv) => t(`proficiency_${lv}`),
    present: t('present'),
    dob: t('dateOfBirth'),
    license: t('drivingLicense'),
  };
}
