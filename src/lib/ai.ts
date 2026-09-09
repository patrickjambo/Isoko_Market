import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';

/**
 * Thin, optional Claude wrapper. AI is an ENHANCEMENT, never a hard dependency:
 * every caller falls back to a deterministic rule-based path when this returns
 * null (no key configured, or the API errored/timed out), so the product works
 * identically with or without an ANTHROPIC_API_KEY. Server-only — the key never
 * reaches the browser.
 */
export const aiConfigured = Boolean(env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
function getClient(): Anthropic {
  // Reuse one client (keeps connections warm across requests on a warm lambda).
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

/**
 * Generate a short piece of text with Claude. Returns the trimmed text, or
 * `null` if AI isn't configured or the call fails — callers MUST handle null by
 * falling back to their non-AI path. Kept non-streaming + small max_tokens: the
 * outputs here (a description, a summary) are short, so this stays well under
 * the SDK's HTTP-timeout threshold.
 */
export async function generateText(opts: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<string | null> {
  if (!aiConfigured) return null;
  try {
    const res = await getClient().messages.create({
      model: env.AI_MODEL,
      max_tokens: opts.maxTokens ?? 600,
      system: opts.system,
      messages: [{ role: 'user', content: opts.prompt }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || null;
  } catch (err) {
    // Never surface an AI outage to the user — log and let the caller fall back.
    // eslint-disable-next-line no-console
    console.error('[ai] generateText failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Suggest the FEATURE LABELS a seller should fill in for THIS specific product,
 * so buyers see the details that matter for it (a phone's RAM, a car's mileage,
 * a shoe's size…). Labels only — the seller fills the values. Returns null when
 * AI isn't configured/available so the caller can fall back to the keyword map.
 */
export async function aiSuggestSpecs(input: {
  title: string;
  category?: string;
}): Promise<string[] | null> {
  const text = await generateText({
    maxTokens: 120,
    system:
      'You help a seller list an item on a Rwandan marketplace. Given the item, ' +
      'output the FEATURE LABELS a buyer would want to know — the fields the seller ' +
      'should fill in. Rules: 4–8 labels, each 1–3 words, specific to THAT product ' +
      'type, most important first. Examples — phone: Brand, Model, Storage, RAM, ' +
      'Battery, Color; car: Make, Model, Year, Mileage, Fuel, Transmission; shoes: ' +
      'Brand, Size, Color, Material; rice: Type, Weight, Quantity. Output ONLY the ' +
      'labels as a comma-separated list. No values, no numbers, no other text.',
    prompt: `Item: ${input.title}${input.category ? ` (category: ${input.category})` : ''}`,
  });
  if (!text) return null;
  const labels = [
    ...new Set(
      text
        .split(/[,\n]/)
        .map((s) => s.replace(/^[-*\d.\)\s]+/, '').trim())
        .filter((s) => s.length > 0 && s.length <= 40)
    ),
  ];
  return labels.length ? labels.slice(0, 8) : null;
}

const LANG: Record<string, string> = { rw: 'Kinyarwanda', en: 'English', fr: 'French' };

/**
 * AI draft of a marketplace listing description from the seller's attributes.
 * Honesty-first: it may ONLY use the details provided — never invent specs,
 * defects, or claims the seller didn't state. Written in the seller's locale.
 */
export async function aiListingDescription(input: {
  title: string;
  category?: string;
  condition?: string;
  location?: string;
  tags?: string[];
  locale?: string;
  kind?: 'PRODUCT' | 'SERVICE';
}): Promise<string | null> {
  const lang = LANG[input.locale ?? 'rw'] ?? 'Kinyarwanda';
  const isService = input.kind === 'SERVICE';
  const facts = [
    `Title: ${input.title}`,
    input.category && `Category: ${input.category}`,
    // Condition is only meaningful for a physical item, never a service.
    !isService && input.condition && `Condition: ${input.condition}`,
    input.location && `Location: ${input.location}`,
    input.tags?.length && `Tags: ${input.tags.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  const system = isService
    ? `You write concise, trustworthy descriptions of SERVICES offered on Isoko Market, ` +
      `a marketplace for young people in Rwanda. Write 2–4 short sentences in ${lang} describing ` +
      `the service the person provides and what a client can expect. Be warm and clear. Use ONLY ` +
      `the facts provided — never invent qualifications, experience, guarantees, or claims that ` +
      `aren't given. Do not describe it as a physical item and do not mention condition. No emojis, ` +
      `no hype, no price. Output ONLY the description text, nothing else.`
    : `You write concise, trustworthy marketplace listing descriptions for Isoko Market, ` +
      `a marketplace for young people in Rwanda. Write 2–4 short sentences in ${lang}. ` +
      `Be warm and clear. Use ONLY the facts provided — never invent specifications, ` +
      `brands, measurements, defects, or claims that aren't given. No emojis, no hype, ` +
      `no price. Output ONLY the description text, nothing else.`;

  return generateText({
    maxTokens: 400,
    system,
    prompt: `Write a ${isService ? 'service' : 'listing'} description from these details:\n${facts}`,
  });
}
