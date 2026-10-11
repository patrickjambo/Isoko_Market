import { labelForSkill } from '@/lib/skills';
import type { CvData } from '@/lib/validators/cv';

export const POPULAR_ROLES = [
  { en: 'Software Developer', rw: 'Umukorabushakashatsi muri Porogaramu', fr: 'Développeur Logiciel' },
  { en: 'Accountant', rw: 'Umucungamari', fr: 'Comptable' },
  { en: 'Sales & Marketing Specialist', rw: 'Inzobere mu Bucuruzi n’Iyamamazabikorwa', fr: 'Spécialiste Vente & Marketing' },
  { en: 'Administrative Assistant', rw: 'Umufasha mu Buyobozi', fr: 'Assistant Administratif' },
  { en: 'Driver', rw: 'Umushoferi', fr: 'Chauffeur' },
  { en: 'Chef / Cook', rw: 'Umutetsi', fr: 'Cuisinier / Chef' },
  { en: 'Electrician', rw: 'Umunyamashanyarazi', fr: 'Électricien' },
  { en: 'Customer Support Agent', rw: 'Ushinzwe Kwakira Abakiriya', fr: 'Agent Service Client' },
  { en: 'Civil Engineer', rw: 'Injeniyeri w’Ubwubatsi', fr: 'Ingénieur Génie Civil' },
  { en: 'Teacher / Tutor', rw: 'Umwarimu', fr: 'Enseignant' },
] as const;

export type MissingField = {
  key: string;
  labelKey: string;
  fieldId: string;
};

/**
 * Calculate the CV completeness percentage and enumerate missing essential or standard fields.
 */
export function calculateCvCompleteness(data: CvData): {
  score: number;
  missingFields: MissingField[];
  isStandardReady: boolean;
} {
  const missing: MissingField[] = [];
  let score = 0;

  // 1. Headline (15%)
  if (data.headline?.trim() && data.headline.trim().length >= 3) {
    score += 15;
  } else {
    missing.push({ key: 'headline', labelKey: 'missing_headline', fieldId: 'headline' });
  }

  // 2. Contact Email (15%)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.contactEmail?.trim() && emailRegex.test(data.contactEmail.trim())) {
    score += 15;
  } else {
    missing.push({ key: 'contactEmail', labelKey: 'missing_contactEmail', fieldId: 'contactEmail' });
  }

  // 3. Location (15%)
  if (data.location?.id || data.location?.label) {
    score += 15;
  } else {
    missing.push({ key: 'location', labelKey: 'missing_location', fieldId: 'location' });
  }

  // 4. Skills (15%)
  if (data.skills && data.skills.length > 0) {
    score += 15;
  } else {
    missing.push({ key: 'skills', labelKey: 'missing_skills', fieldId: 'skills' });
  }

  // 5. Summary (15%)
  if (data.summary?.trim() && data.summary.trim().length >= 10) {
    score += 15;
  } else {
    missing.push({ key: 'summary', labelKey: 'missing_summary', fieldId: 'summary' });
  }

  // 6. Experience (15%)
  const hasValidExp =
    data.experience &&
    data.experience.length > 0 &&
    data.experience.some((e) => e.company?.trim() && e.position?.trim());
  if (hasValidExp) {
    score += 15;
  } else {
    missing.push({ key: 'experience', labelKey: 'missing_experience', fieldId: 'experience' });
  }

  // 7. Education (10%)
  const hasValidEdu =
    data.education &&
    data.education.length > 0 &&
    data.education.some((e) => e.institutionName?.trim() || e.institutionId?.trim());
  if (hasValidEdu) {
    score += 10;
  } else {
    missing.push({ key: 'education', labelKey: 'missing_education', fieldId: 'education' });
  }

  return {
    score,
    missingFields: missing,
    isStandardReady:
      score >= 85 &&
      !missing.some((m) => ['headline', 'contactEmail', 'location', 'skills', 'summary'].includes(m.key)),
  };
}

/**
 * Intelligent professional summary drafting based on role, skills and locale.
 */
export function draftSummary(input: {
  headline?: string;
  skills?: string[];
  locale?: string;
}): string {
  const { headline = '', skills = [], locale = 'en' } = input;
  const l = locale === 'rw' || locale === 'fr' ? locale : 'en';
  const h = headline.trim();
  const topSkills = skills.slice(0, 4).map((k) => labelForSkill(k, l));
  const skillText = topSkills.join(', ');

  if (l === 'rw') {
    if (h && skillText) {
      return `Ndi umunyamwuga witanga kandi w'indashyikirwa nka ${h}, ufite ubumenyi n'inararibonye muri ${skillText}. Mfite umuhate wo gutanga umusaruro ugaragara, gukemura ibibazo no gukorana neza n'ikipe igamije iterambere ry'ikigo.`;
    }
    if (h) {
      return `Ndi umunyamwuga witanga nka ${h}, ufite ubushake bwo gukora cyane, kwiga vuba no gutanga umusaruro mwiza mu nshingano zose nshinzwe.`;
    }
    if (skillText) {
      return `Umunyamwuga ufite ubumenyi n'ubushobozi muri ${skillText}. Uhora yiteguye gushyira mu bikorwa ubumenyi bwe ngo atere imbere kandi ateze imbere umukoresha.`;
    }
    return 'Umunyamwuga witanga, ufite umwete n’umurava wo gukora akazi neza no gushyigikira iterambere ry’ikigo.';
  }

  if (l === 'fr') {
    if (h && skillText) {
      return `Professionnel(le) dynamique et motivé(e) en tant que ${h}, doté(e) d'une solide expertise en ${skillText}. Démontre une excellente capacité à résoudre les problèmes, à collaborer en équipe et à atteindre les objectifs fixés avec rigueur.`;
    }
    if (h) {
      return `Professionnel(le) engagé(e) comme ${h}, avec une grande rigueur de travail et la volonté d'apporter une réelle valeur ajoutée à l'organisation.`;
    }
    if (skillText) {
      return `Professionnel(le) qualifié(e) avec des compétences avérées en ${skillText}, orienté(e) vers les résultats et le travail bien fait.`;
    }
    return 'Professionnel(le) motivé(e), adaptable et rigoureux(se), prêt(e) à mettre ses compétences au service du développement de l’entreprise.';
  }

  // English default
  if (h && skillText) {
    return `Results-driven and passionate ${h} with proven experience in ${skillText}. Committed to delivering high-quality results, solving operational challenges, and collaborating effectively within multidisciplinary teams to drive organizational success.`;
  }
  if (h) {
    return `Dedicated and results-oriented ${h} with a strong work ethic, rapid learning ability, and a track record of achieving excellence in demanding environments.`;
  }
  if (skillText) {
    return `Skilled and versatile professional with hands-on expertise in ${skillText}. Adept at problem-solving and delivering quality outcomes that exceed expectations.`;
  }
  return 'Motivated and detail-oriented professional with a strong commitment to excellence, continuous learning, and contributing positively to organizational growth.';
}

/**
 * Standard complete sample CV data tailored to Rwanda / East Africa job market.
 */
export function getSampleCv(locale: string = 'en'): CvData {
  const isRw = locale === 'rw';
  const isFr = locale === 'fr';

  if (isRw) {
    return {
      headline: 'Inzobere mu Ibaruramari n’Ubuyobozi',
      summary:
        'Inzobere mu ibaruramari n’ubuyobozi ifite inararibonye y’imyaka irenga 3 mu gucunga imari, gutegura raporo n’ubugenzuzi. Nyobowe no gutanga umusaruro wihuse kandi wujuje ubuziranenge.',
      contactEmail: 'rebero.mugisha@example.com',
      portfolioUrl: 'https://linkedin.com/in/rebero-sample',
      dateOfBirth: '1996-05-14',
      nationality: 'Umunyarwanda',
      gender: 'male',
      drivingLicense: 'B',
      skills: ['accounting', 'administration', 'customer_service'],
      skillLevels: { accounting: 'expert', administration: 'experienced', customer_service: 'experienced' },
      languages: [
        { code: 'rw', level: 'native' },
        { code: 'en', level: 'fluent' },
        { code: 'fr', level: 'conversational' },
      ],
      experience: [
        {
          position: 'Umucungamari Mukuru (Senior Accountant)',
          company: 'Kigali Commerce Ltd',
          startYear: '2022',
          endYear: '',
          summary: 'Nshinzwe gukurikirana ibaruramari rya buri munsi, imisoro ya RRA na raporo z’imari za buri kwezi.',
        },
      ],
      education: [
        {
          level: 'bachelor',
          institutionId: '',
          institutionName: 'University of Rwanda (CBE)',
          facultyId: '',
          facultyName: 'Finance and Accounting',
          combinationId: '',
          combinationName: '',
          degreeClassification: 'UPPER_SECOND',
          startYear: '2017',
          endYear: '2021',
          certificateUrl: '',
        },
      ],
      certifications: [
        {
          name: 'Certified Public Accountant (CPA Foundation)',
          issuer: 'ICPAR',
          year: '2022',
          url: '',
        },
      ],
      references: [
        {
          name: 'Jean Paul Habimana',
          relationship: 'Umuyobozi w’Imari (Finance Manager)',
          phone: '+250 788 123 456',
          email: 'jp.habimana@kigalicommerce.rw',
        },
      ],
      location: {
        id: 'kigali_nyarugenge',
        label: 'Kigali City › Nyarugenge › Nyarugenge',
      },
    };
  }

  if (isFr) {
    return {
      headline: 'Comptable & Gestionnaire Financier',
      summary:
        'Professionnel de la finance rigoureux avec plus de 3 ans d’expérience dans la tenue des comptes, la fiscalité et la gestion budgétaire. Capacité éprouvée à optimiser les processus et produire des états financiers fiables.',
      contactEmail: 'rebero.mugisha@example.com',
      portfolioUrl: 'https://linkedin.com/in/rebero-sample',
      dateOfBirth: '1996-05-14',
      nationality: 'Rwandaise',
      gender: 'male',
      drivingLicense: 'B',
      skills: ['accounting', 'administration', 'customer_service'],
      skillLevels: { accounting: 'expert', administration: 'experienced', customer_service: 'experienced' },
      languages: [
        { code: 'fr', level: 'fluent' },
        { code: 'en', level: 'fluent' },
        { code: 'rw', level: 'native' },
      ],
      experience: [
        {
          position: 'Comptable Principal',
          company: 'Kigali Commerce Ltd',
          startYear: '2022',
          endYear: '',
          summary: 'Responsable de la comptabilité générale, des déclarations fiscales et de la préparation des audits annuels.',
        },
      ],
      education: [
        {
          level: 'bachelor',
          institutionId: '',
          institutionName: 'University of Rwanda (CBE)',
          facultyId: '',
          facultyName: 'Finance & Comptabilité',
          combinationId: '',
          combinationName: '',
          degreeClassification: 'UPPER_SECOND',
          startYear: '2017',
          endYear: '2021',
          certificateUrl: '',
        },
      ],
      certifications: [
        {
          name: 'Certificat en Comptabilité Appliquée',
          issuer: 'ICPAR',
          year: '2022',
          url: '',
        },
      ],
      references: [
        {
          name: 'Jean Paul Habimana',
          relationship: 'Directeur Financier',
          phone: '+250 788 123 456',
          email: 'jp.habimana@kigalicommerce.rw',
        },
      ],
      location: {
        id: 'kigali_nyarugenge',
        label: 'Kigali City › Nyarugenge › Nyarugenge',
      },
    };
  }

  return {
    headline: 'Senior Accountant & Financial Analyst',
    summary:
      'Detail-oriented and results-driven accounting professional with 3+ years of experience in bookkeeping, taxation, and financial reporting. Proven track record in streamlining reconciliations and maintaining accurate financial records.',
    contactEmail: 'rebero.mugisha@example.com',
    portfolioUrl: 'https://linkedin.com/in/rebero-sample',
    dateOfBirth: '1996-05-14',
    nationality: 'Rwandan',
    gender: 'male',
    drivingLicense: 'B',
    skills: ['accounting', 'administration', 'customer_service'],
    skillLevels: { accounting: 'expert', administration: 'experienced', customer_service: 'experienced' },
    languages: [
      { code: 'en', level: 'fluent' },
      { code: 'rw', level: 'native' },
      { code: 'fr', level: 'conversational' },
    ],
    experience: [
      {
        position: 'Senior Accountant',
        company: 'Kigali Commerce Ltd',
        startYear: '2022',
        endYear: '',
        summary: 'Oversee daily general ledger entries, monthly tax returns to RRA, payroll preparation, and quarterly financial audits.',
      },
    ],
    education: [
      {
        level: 'bachelor',
        institutionId: '',
        institutionName: 'University of Rwanda (CBE)',
        facultyId: '',
        facultyName: 'Finance and Accounting',
        combinationId: '',
        combinationName: '',
        degreeClassification: 'UPPER_SECOND',
        startYear: '2017',
        endYear: '2021',
        certificateUrl: '',
      },
    ],
    certifications: [
      {
        name: 'Certified Public Accountant (CPA Foundation)',
        issuer: 'ICPAR',
        year: '2022',
        url: '',
      },
    ],
    references: [
      {
        name: 'Jean Paul Habimana',
        relationship: 'Finance Director',
        phone: '+250 788 123 456',
        email: 'jp.habimana@kigalicommerce.rw',
      },
    ],
    location: {
      id: 'kigali_nyarugenge',
      label: 'Kigali City › Nyarugenge › Nyarugenge',
    },
  };
}
