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
}): Promise<string | null> {
  const lang = LANG[input.locale ?? 'rw'] ?? 'Kinyarwanda';
  const facts = [
    `Title: ${input.title}`,
    input.category && `Category: ${input.category}`,
    input.condition && `Condition: ${input.condition}`,
    input.location && `Location: ${input.location}`,
    input.tags?.length && `Tags: ${input.tags.join(', ')}`,
  ]
    .filter(Boolean)
    .join('\n');

  return generateText({
    maxTokens: 400,
    system:
      `You write concise, trustworthy marketplace listing descriptions for Isoko Market, ` +
      `a marketplace for young people in Rwanda. Write 2–4 short sentences in ${lang}. ` +
      `Be warm and clear. Use ONLY the facts provided — never invent specifications, ` +
      `brands, measurements, defects, or claims that aren't given. No emojis, no hype, ` +
      `no price. Output ONLY the description text, nothing else.`,
    prompt: `Write a listing description from these details:\n${facts}`,
  });
}
