/**
 * Shared skills taxonomy (Job Seeker + Employer spec §2, §10).
 *
 * ONE controlled vocabulary drawn on by the CV builder, the job-posting form and
 * job search — so a seeker's listed skill and an employer's required skill are
 * the same canonical token, making the match-quality score meaningful rather
 * than a fuzzy guess.
 *
 * This module is deliberately pure (no `server-only`, no Prisma) so it can be
 * imported by both Server Components/route handlers AND Client Components (the
 * skill picker, the experience-description assist).
 *
 * A skill is stored everywhere as its canonical `key` (e.g. `"tailoring"`); the
 * trilingual label is resolved at render time via {@link labelForSkill}.
 */

export type SkillGroupKey =
  | 'trades'
  | 'service'
  | 'logistics'
  | 'agriculture'
  | 'digital'
  | 'care'
  | 'hospitality'
  | 'construction'
  | 'creative'
  | 'admin';

export type Skill = {
  key: string;
  group: SkillGroupKey;
  rw: string;
  en: string;
  fr: string;
};

/** Curated common-skills taxonomy — trades-first, informal-friendly (§3). */
export const SKILLS: readonly Skill[] = [
  // Trades
  { key: 'tailoring', group: 'trades', en: 'Tailoring', rw: 'Kudoda', fr: 'Couture' },
  { key: 'carpentry', group: 'trades', en: 'Carpentry', rw: 'Ububaji', fr: 'Menuiserie' },
  { key: 'welding', group: 'trades', en: 'Welding', rw: 'Guhomekanya icyuma', fr: 'Soudure' },
  { key: 'plumbing', group: 'trades', en: 'Plumbing', rw: 'Amazi n’imiyoboro', fr: 'Plomberie' },
  { key: 'electrical', group: 'trades', en: 'Electrical work', rw: 'Amashanyarazi', fr: 'Électricité' },
  { key: 'mechanics', group: 'trades', en: 'Mechanics', rw: 'Ubumekanike', fr: 'Mécanique' },
  { key: 'phone_repair', group: 'trades', en: 'Phone repair', rw: 'Gukora telefone', fr: 'Réparation téléphone' },
  { key: 'hairdressing', group: 'trades', en: 'Hairdressing', rw: 'Gutunganya umusatsi', fr: 'Coiffure' },
  { key: 'shoemaking', group: 'trades', en: 'Shoe making & repair', rw: 'Gukora inkweto', fr: 'Cordonnerie' },

  // Service & sales
  { key: 'customer_service', group: 'service', en: 'Customer service', rw: 'Serivisi ku bakiriya', fr: 'Service client' },
  { key: 'sales', group: 'service', en: 'Sales', rw: 'Kugurisha', fr: 'Vente' },
  { key: 'cashier', group: 'service', en: 'Cashier', rw: 'Kwakira amafaranga', fr: 'Caissier' },
  { key: 'shop_keeping', group: 'service', en: 'Shop keeping', rw: 'Gucunga iduka', fr: 'Tenue de boutique' },
  { key: 'marketing', group: 'service', en: 'Marketing', rw: 'Kwamamaza', fr: 'Marketing' },

  // Logistics & driving
  { key: 'driving', group: 'logistics', en: 'Driving', rw: 'Gutwara imodoka', fr: 'Conduite' },
  { key: 'motorcycle_taxi', group: 'logistics', en: 'Motorcycle taxi (moto)', rw: 'Kwaka moto', fr: 'Moto-taxi' },
  { key: 'delivery', group: 'logistics', en: 'Delivery', rw: 'Gutanga ibicuruzwa', fr: 'Livraison' },
  { key: 'warehouse', group: 'logistics', en: 'Warehouse / stock', rw: 'Ububiko', fr: 'Entrepôt / stock' },

  // Agriculture
  { key: 'farming', group: 'agriculture', en: 'Farming', rw: 'Ubuhinzi', fr: 'Agriculture' },
  { key: 'livestock', group: 'agriculture', en: 'Livestock', rw: 'Ubworozi', fr: 'Élevage' },
  { key: 'gardening', group: 'agriculture', en: 'Gardening / landscaping', rw: 'Ubusitani', fr: 'Jardinage' },

  // Digital & IT
  { key: 'it_support', group: 'digital', en: 'IT support', rw: 'Gufasha muri IT', fr: 'Support informatique' },
  { key: 'data_entry', group: 'digital', en: 'Data entry', rw: 'Kwinjiza amakuru', fr: 'Saisie de données' },
  { key: 'graphic_design', group: 'digital', en: 'Graphic design', rw: 'Igishushanyo', fr: 'Design graphique' },
  { key: 'web_development', group: 'digital', en: 'Web development', rw: 'Gukora urubuga', fr: 'Développement web' },
  { key: 'social_media', group: 'digital', en: 'Social media', rw: 'Imbuga nkoranyambaga', fr: 'Réseaux sociaux' },

  // Care & health
  { key: 'childcare', group: 'care', en: 'Childcare', rw: 'Kurera abana', fr: 'Garde d’enfants' },
  { key: 'elderly_care', group: 'care', en: 'Elderly care', rw: 'Kwita ku basaza', fr: 'Aide aux personnes âgées' },
  { key: 'nursing', group: 'care', en: 'Nursing / first aid', rw: 'Ubuforomo', fr: 'Soins infirmiers' },
  { key: 'cleaning', group: 'care', en: 'Cleaning', rw: 'Isuku', fr: 'Nettoyage' },

  // Hospitality
  { key: 'cooking', group: 'hospitality', en: 'Cooking', rw: 'Guteka', fr: 'Cuisine' },
  { key: 'waiting_tables', group: 'hospitality', en: 'Waiting tables', rw: 'Gukorera muri resitora', fr: 'Service en salle' },
  { key: 'baking', group: 'hospitality', en: 'Baking', rw: 'Kubumba imigati', fr: 'Boulangerie' },
  { key: 'bartending', group: 'hospitality', en: 'Bartending', rw: 'Kubartender', fr: 'Barman' },

  // Construction
  { key: 'masonry', group: 'construction', en: 'Masonry', rw: 'Ubwubatsi', fr: 'Maçonnerie' },
  { key: 'painting', group: 'construction', en: 'Painting', rw: 'Gusiga irangi', fr: 'Peinture' },
  { key: 'tiling', group: 'construction', en: 'Tiling', rw: 'Gushyira amakaro', fr: 'Carrelage' },

  // Creative
  { key: 'photography', group: 'creative', en: 'Photography', rw: 'Gufata amafoto', fr: 'Photographie' },
  { key: 'videography', group: 'creative', en: 'Videography', rw: 'Gufata amashusho', fr: 'Vidéographie' },
  { key: 'music', group: 'creative', en: 'Music / performance', rw: 'Umuziki', fr: 'Musique' },

  // Admin & office
  { key: 'accounting', group: 'admin', en: 'Accounting / bookkeeping', rw: 'Ibaruramari', fr: 'Comptabilité' },
  { key: 'administration', group: 'admin', en: 'Office administration', rw: 'Ubuyobozi bw’ibiro', fr: 'Administration' },
  { key: 'teaching', group: 'admin', en: 'Teaching / tutoring', rw: 'Kwigisha', fr: 'Enseignement' },
  { key: 'translation', group: 'admin', en: 'Translation', rw: 'Guhindura indimi', fr: 'Traduction' },
] as const;

const BY_KEY = new Map(SKILLS.map((s) => [s.key, s]));

// Reverse lookup: every locale label (lowercased) → canonical key. Lets us
// normalize legacy free-text skills so matching still works.
const LABEL_TO_KEY = new Map<string, string>();
for (const s of SKILLS) {
  for (const label of [s.en, s.rw, s.fr]) LABEL_TO_KEY.set(label.toLowerCase(), s.key);
  LABEL_TO_KEY.set(s.key.toLowerCase(), s.key);
}

type Loc = 'rw' | 'en' | 'fr';
function loc(locale: string): Loc {
  return locale === 'rw' || locale === 'fr' ? locale : 'en';
}

/** Human label for a stored skill key (falls back to the raw value for free text). */
export function labelForSkill(key: string, locale = 'en'): string {
  const s = BY_KEY.get(key);
  if (s) return s[loc(locale)];
  // Legacy free-text skill that happens to be a known label in some locale.
  const canon = LABEL_TO_KEY.get(key.toLowerCase());
  if (canon) return BY_KEY.get(canon)![loc(locale)];
  return key;
}

/** Normalize any skill string (key or free-text label) to its canonical token. */
export function canonicalSkill(input: string): string {
  const v = input.trim().toLowerCase();
  return LABEL_TO_KEY.get(v) ?? v;
}

export type SkillSuggestion = { key: string; label: string };

/**
 * Infer likely required skills from a job title (Employer §3 Step 2) — so the
 * form can pre-fill tap-chips the employer confirms rather than typing a
 * requirements list. Matches taxonomy labels/keys appearing in the title.
 */
export function suggestSkillsFromText(text: string, limit = 6): string[] {
  const words = (text.toLowerCase().match(/[\p{L}]+/gu) ?? []).filter((w) => w.length >= 3);
  if (words.length === 0) return [];
  // Two tokens match if they share a 4-char stem ("tailor"↔"tailoring",
  // "driver"↔"driving") or are equal for short words — cheap morphology.
  const stemEq = (a: string, b: string) =>
    a.length >= 4 && b.length >= 4 ? a.slice(0, 4) === b.slice(0, 4) : a === b;

  const hits: string[] = [];
  for (const s of SKILLS) {
    const labelWords = [s.en, s.rw, s.fr, s.key.replace(/_/g, ' ')]
      .join(' ')
      .toLowerCase()
      .match(/[\p{L}]+/gu)
      ?.filter((w) => w.length >= 3) ?? [];
    if (words.some((w) => labelWords.some((lw) => stemEq(w, lw)))) hits.push(s.key);
    if (hits.length >= limit) break;
  }
  return hits;
}

/** Search-as-you-type over the taxonomy in ALL locales (§2 shared engine). */
export function searchSkills(q: string, locale = 'en', limit = 8): SkillSuggestion[] {
  const query = q.trim().toLowerCase();
  if (query.length < 1) return [];
  const l = loc(locale);
  const scored: { s: Skill; rank: number }[] = [];
  for (const s of SKILLS) {
    const hay = [s.en, s.rw, s.fr, s.key].map((x) => x.toLowerCase());
    const idx = hay.map((h) => h.indexOf(query)).filter((i) => i >= 0);
    if (idx.length === 0) continue;
    // Prefix matches rank above substring matches.
    const best = Math.min(...idx);
    scored.push({ s, rank: best === 0 ? 0 : 1 });
  }
  scored.sort((a, b) => a.rank - b.rank || a.s[l].localeCompare(b.s[l]));
  return scored.slice(0, limit).map(({ s }) => ({ key: s.key, label: s[l] }));
}

// ─────────────────────── Match-quality scoring ───────────────────────

export type MatchTier = 'strong' | 'good' | 'none';

export type MatchResult = {
  score: number; // 0..1 share of the job's required skills the seeker has
  overlap: string[]; // canonical keys the seeker and job share
  tier: MatchTier;
};

/**
 * Overlap between a seeker's CV skills and a job's required skills (§4, §5).
 * Both sides are normalized to canonical keys first, so the score reflects REAL
 * shared skills — never a static placeholder (Definition of Done §4).
 */
export function matchScore(cvSkills: string[], jobSkills: string[]): MatchResult {
  const req = jobSkills.map(canonicalSkill).filter(Boolean);
  if (req.length === 0) return { score: 0, overlap: [], tier: 'none' };
  const have = new Set(cvSkills.map(canonicalSkill).filter(Boolean));
  const overlap = Array.from(new Set(req.filter((k) => have.has(k))));
  const score = overlap.length / req.length;
  const tier: MatchTier = score >= 0.6 ? 'strong' : overlap.length >= 1 ? 'good' : 'none';
  return { score, overlap, tier };
}

// ───────────────── Experience-description assist (§3 Step 3) ─────────────────

// role/skill key → the two most common tasks, trilingual. Powers the editable
// auto-suggested experience description ("Worked as a {role} at {place},
// responsible for {top 2 tasks}").
const ROLE_TASKS: Record<string, { rw: [string, string]; en: [string, string]; fr: [string, string] }> = {
  tailoring: { en: ['making garments', 'taking measurements'], rw: ['kudoda imyenda', 'gufata ibipimo'], fr: ['confection de vêtements', 'prise de mesures'] },
  sales: { en: ['serving customers', 'handling payments'], rw: ['gufasha abakiriya', 'kwakira amafaranga'], fr: ['servir les clients', 'gérer les paiements'] },
  cashier: { en: ['handling cash', 'balancing the till'], rw: ['kwakira amafaranga', 'kubara amafaranga'], fr: ['gestion de la caisse', 'équilibrage de caisse'] },
  driving: { en: ['transporting goods and people', 'maintaining the vehicle'], rw: ['gutwara abantu n’ibintu', 'kubungabunga imodoka'], fr: ['transport de biens et de personnes', 'entretien du véhicule'] },
  delivery: { en: ['delivering orders on time', 'confirming receipts'], rw: ['gutanga ibicuruzwa ku gihe', 'kwemeza ko byakiriwe'], fr: ['livraison ponctuelle', 'confirmation des reçus'] },
  cooking: { en: ['preparing meals', 'keeping the kitchen clean'], rw: ['gutegura ibiryo', 'kubungabunga isuku mu gikoni'], fr: ['préparation des repas', 'propreté de la cuisine'] },
  cleaning: { en: ['cleaning premises', 'restocking supplies'], rw: ['gukora isuku', 'kongera ibikoresho'], fr: ['nettoyage des locaux', 'réapprovisionnement'] },
  masonry: { en: ['laying bricks and blocks', 'mixing mortar'], rw: ['kubaka amatafari', 'kuvanga simenti'], fr: ['pose de briques', 'préparation du mortier'] },
  farming: { en: ['planting and harvesting', 'tending crops'], rw: ['gutera no gusarura', 'kwita ku myaka'], fr: ['plantation et récolte', 'entretien des cultures'] },
  customer_service: { en: ['assisting customers', 'resolving complaints'], rw: ['gufasha abakiriya', 'gukemura ibibazo'], fr: ['assistance aux clients', 'résolution des plaintes'] },
  childcare: { en: ['caring for children', 'preparing meals'], rw: ['kwita ku bana', 'gutegura ibiryo'], fr: ['garde d’enfants', 'préparation des repas'] },
  security: { en: ['guarding premises', 'monitoring access'], rw: ['kurinda ahantu', 'kugenzura abinjira'], fr: ['gardiennage', 'contrôle des accès'] },
  waiting_tables: { en: ['serving customers', 'taking orders'], rw: ['gufasha abakiriya', 'kwakira ibisabwa'], fr: ['service en salle', 'prise de commandes'] },
  hairdressing: { en: ['styling hair', 'advising clients'], rw: ['gutunganya umusatsi', 'kugira inama abakiriya'], fr: ['coiffure', 'conseil aux clients'] },
  mechanics: { en: ['diagnosing faults', 'repairing vehicles'], rw: ['gushakisha ikibazo', 'gukora imodoka'], fr: ['diagnostic des pannes', 'réparation de véhicules'] },
};

/** Best-effort task lookup by fuzzy-matching a free-text role to a known key. */
function tasksFor(role: string): { rw: [string, string]; en: [string, string]; fr: [string, string] } | null {
  const canon = canonicalSkill(role);
  if (ROLE_TASKS[canon]) return ROLE_TASKS[canon];
  const r = role.toLowerCase();
  for (const [key, tasks] of Object.entries(ROLE_TASKS)) {
    const s = BY_KEY.get(key);
    if (s && (r.includes(s.en.toLowerCase()) || r.includes(key))) return tasks;
  }
  return null;
}

/**
 * Editable auto-suggested experience description (§3 Step 3) — never final, just
 * a starting point so seekers aren't faced with a blank box. Trilingual.
 */
export function draftExperience(input: {
  role: string;
  place?: string;
  locale?: string;
}): string {
  const { role, place, locale = 'en' } = input;
  const r = role.trim();
  if (!r) return '';
  const l = loc(locale);
  const tasks = tasksFor(r);
  const t = tasks ? tasks[l] : null;

  if (l === 'rw') {
    let s = `Nakoze nka ${r}`;
    if (place?.trim()) s += ` kwa ${place.trim()}`;
    if (t) s += `, nshinzwe ${t[0]} no ${t[1]}`;
    return s + '.';
  }
  if (l === 'fr') {
    let s = `J’ai travaillé comme ${r}`;
    if (place?.trim()) s += ` chez ${place.trim()}`;
    if (t) s += `, chargé(e) de ${t[0]} et ${t[1]}`;
    return s + '.';
  }
  let s = `Worked as a ${r}`;
  if (place?.trim()) s += ` at ${place.trim()}`;
  if (t) s += `, responsible for ${t[0]} and ${t[1]}`;
  return s + '.';
}

/**
 * Editable auto-drafted job description (Employer §3 Step 5) from the structured
 * fields the employer already picked — the mirror of the seller listing assist,
 * so the whole platform feels like one tool. Trilingual, never final.
 */
export function draftJobDescription(input: {
  title: string;
  type?: 'JOB' | 'GIG';
  skills?: string[];
  location?: string;
  pay?: string;
  locale?: string;
}): string {
  const { title, type = 'JOB', skills = [], location, pay, locale = 'en' } = input;
  const l = loc(locale);
  const t = title.trim();
  if (!t) return '';
  const skillLabels = skills.slice(0, 5).map((k) => labelForSkill(k, l));
  const kind = type === 'GIG';

  if (l === 'rw') {
    let s = kind ? `Dushaka umuntu wakora akazi ka ${t}` : `Dushaka umukozi wa ${t}`;
    if (location?.trim()) s += ` i ${location.trim()}`;
    s += '.';
    if (skillLabels.length) s += ` Ubumenyi busabwa: ${skillLabels.join(', ')}.`;
    if (pay) s += ` Umushahara: ${pay}.`;
    s += ' Saba nonaha niba ubishoboye.';
    return s;
  }
  if (l === 'fr') {
    let s = kind ? `Nous recherchons quelqu’un pour une mission de ${t}` : `Nous recherchons un(e) ${t}`;
    if (location?.trim()) s += ` à ${location.trim()}`;
    s += '.';
    if (skillLabels.length) s += ` Compétences requises : ${skillLabels.join(', ')}.`;
    if (pay) s += ` Rémunération : ${pay}.`;
    s += ' Postulez dès maintenant si cela vous correspond.';
    return s;
  }
  let s = kind ? `We're looking for someone for a ${t} gig` : `We're hiring a ${t}`;
  if (location?.trim()) s += ` in ${location.trim()}`;
  s += '.';
  if (skillLabels.length) s += ` Skills needed: ${skillLabels.join(', ')}.`;
  if (pay) s += ` Pay: ${pay}.`;
  s += ' Apply now if this is a good fit.';
  return s;
}

/**
 * Editable auto-drafted marketplace listing description (trilingual) from
 * structured attributes — the seller-side mirror of {@link draftJobDescription}.
 * Lives here (not in the server-only suggestions module) so the client can draft
 * offline AND /api/suggestions/description can wrap the same single function.
 */
export function draftDescription(input: {
  title: string;
  category?: string;
  condition?: string;
  location?: string;
  tags?: string[];
  locale?: string;
  kind?: 'PRODUCT' | 'SERVICE';
}): string {
  const { title, category, condition, location, tags = [], locale = 'en', kind } = input;
  const tagLine = tags.length ? tags.join(', ') : '';

  // Services never carry a condition and read as an offer, not an item for sale.
  if (kind === 'SERVICE') {
    if (locale === 'rw') {
      let s = `Ntanga serivisi ya ${title}${category ? ` mu cyiciro cya ${category}` : ''}`.trim();
      if (location) s += `, nkorera i ${location}`;
      s += '.';
      if (tagLine) s += ` Ibyo ntanga: ${tagLine}.`;
      s += ' Vugana nanjye kugira ngo tubiganireho.';
      return s;
    }
    if (locale === 'fr') {
      let s = `Je propose un service de ${title}${category ? ` (${category})` : ''}`.trim();
      if (location) s += `, disponible à ${location}`;
      s += '.';
      if (tagLine) s += ` Prestations : ${tagLine}.`;
      s += ' Contactez-moi pour en discuter.';
      return s;
    }
    let s = `I offer ${title}${category ? ` (${category})` : ''} services`.trim();
    if (location) s += `, available in ${location}`;
    s += '.';
    if (tagLine) s += ` What I offer: ${tagLine}.`;
    s += ' Message me to discuss.';
    return s;
  }

  const cond = condition ? conditionWord(condition, locale) : '';

  if (locale === 'rw') {
    let s = `${cond} ${title}${category ? ` mu cyiciro cya ${category}` : ''}`.trim();
    if (location) s += `, kiri i ${location}`;
    s += '.';
    if (tagLine) s += ` Ibiranga: ${tagLine}.`;
    s += ' Vugana nanjye kugira ngo tubiganireho.';
    return s;
  }
  if (locale === 'fr') {
    let s = `${title} ${cond ? `(${cond})` : ''}${category ? ` — catégorie ${category}` : ''}`.trim();
    if (location) s += `, situé à ${location}`;
    s += '.';
    if (tagLine) s += ` Caractéristiques : ${tagLine}.`;
    s += ' Contactez-moi pour en discuter.';
    return s;
  }
  let s = `${cond} ${title}${category ? ` in ${category}` : ''}`.trim();
  if (location) s += `, located in ${location}`;
  s += '.';
  if (tagLine) s += ` Features: ${tagLine}.`;
  s += ' Message me to discuss.';
  return s;
}

function conditionWord(condition: string, locale: string): string {
  const map: Record<string, Record<string, string>> = {
    NEW: { en: 'New', rw: 'Gishya', fr: 'Neuf' },
    LIKE_NEW: { en: 'Like-new', rw: 'Nka gishya', fr: 'Comme neuf' },
    GOOD: { en: 'Good-condition', rw: 'Cyiza', fr: 'Bon état' },
    FAIR: { en: 'Used', rw: 'Cyakoreshejwe', fr: 'Occasion' },
    FOR_PARTS: { en: 'For-parts', rw: "Cy'ibice", fr: 'Pour pièces' },
  };
  return map[condition]?.[locale] ?? map[condition]?.en ?? '';
}
