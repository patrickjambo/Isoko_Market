import 'server-only';
import { env } from './env';
import { prisma } from './prisma';

const GEMINI_MODELS = [
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash',
];

const VISION_PROMPT = `You are a product search assistant for Zenova, an African marketplace.
Analyze this product image and return a JSON object with:
1. "description": A detailed, search-friendly description of the product. Include: object type, color, shape, material, brand (only if clearly visible), condition, notable features, and any text visible on the product. Write it as a buyer would describe what they're looking for.
2. "tags": 12-15 comma-separated search keywords covering: product name, synonyms, color, material, use case, category. Include both English and common Kinyarwanda terms if applicable (e.g. "phone, telefoni, smartphone").

Respond ONLY with valid JSON in this exact format:
{"description":"...","tags":"..."}

Be specific about visual characteristics. Never invent brand names. If unsure about something, describe what you see.`;

/**
 * Use Gemini vision to generate a text description and search tags for a product image.
 * Accepts either a public image URL or raw bytes + mimeType.
 * Returns null if Gemini is not configured or the call fails.
 */
export async function describeImageForSearch(
  input: string | { bytes: ArrayBuffer; mimeType: string },
): Promise<{
  description: string;
  tags: string;
} | null> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  for (const model of GEMINI_MODELS) {
    try {
      let base64: string;
      let mimeType: string;

      if (typeof input === 'string') {
        // URL path: fetch image bytes
        const imgRes = await fetch(input, { signal: AbortSignal.timeout(10_000) });
        if (!imgRes.ok) continue;
        const imgBuffer = await imgRes.arrayBuffer();
        base64 = Buffer.from(imgBuffer).toString('base64');
        mimeType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0]!;
      } else {
        // Raw bytes path: no extra network hop
        base64 = Buffer.from(input.bytes).toString('base64');
        mimeType = input.mimeType;
      }

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: VISION_PROMPT },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.1 },
          }),
          signal: AbortSignal.timeout(20_000),
        }
      );

      if (!res.ok) {
        const status = res.status;
        // 429 or 503 → try next model; 400 → bad request, skip
        if (status === 400) break;
        continue;
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;

      const parsed = JSON.parse(jsonMatch[0]) as { description?: string; tags?: string };
      if (parsed.description && parsed.tags) {
        return {
          description: parsed.description.slice(0, 1000),
          tags: parsed.tags.slice(0, 500),
        };
      }
    } catch {
      // Network error or timeout — try next model
    }
  }
  return null;
}

/**
 * Visual similarity search:
 * 1. Describe the query image with Gemini vision.
 * 2. Find ACTIVE listings whose images' AI tags/description match.
 * 3. Fall back to title/description full-text search for unlabelled listings.
 * Returns up to 24 listing IDs sorted by relevance score.
 */
export async function visualSearchListings(
  input: string | { bytes: ArrayBuffer; mimeType: string },
): Promise<{
  listingIds: string[];
  queryDescription: string;
  queryTags: string;
} | null> {
  const result = await describeImageForSearch(input);
  if (!result) return null;

  const { description, tags } = result;

  // Extract top keywords (deduplicated, meaningful length)
  const allWords = [
    ...tags.split(',').map((t) => t.trim()),
    // pull key nouns from first 60 words of description
    ...description.split(/\s+/).slice(0, 60),
  ]
    .map((w) => w.toLowerCase().replace(/[^a-z0-9éèêëàâùûîïôç]/g, '').trim())
    .filter((w) => w.length > 2);

  // Deduplicate, keep top 12
  const keywords = [...new Set(allWords)].slice(0, 12);
  // Top 5 for DB OR clauses (avoid massive query)
  const topKw = keywords.slice(0, 5);

  // 1. Find listing images whose AI tags/description match
  const imgMatches = await prisma.listingImage.findMany({
    where: {
      position: 0,
      listing: { status: 'ACTIVE' },
      OR: topKw.flatMap((kw) => [
        { aiTags: { contains: kw, mode: 'insensitive' as const } },
        { aiDescription: { contains: kw, mode: 'insensitive' as const } },
      ]),
    },
    select: { listingId: true, aiTags: true, aiDescription: true },
    take: 80,
  });

  // 2. Also search listing title/description for listings not yet indexed
  const titleMatches = await prisma.listing.findMany({
    where: {
      status: 'ACTIVE',
      OR: topKw.flatMap((kw) => [
        { title: { contains: kw, mode: 'insensitive' as const } },
        { description: { contains: kw, mode: 'insensitive' as const } },
      ]),
    },
    select: { id: true },
    take: 40,
  });

  // Score results
  const scores = new Map<string, number>();

  for (const img of imgMatches) {
    const combined = `${img.aiDescription ?? ''} ${img.aiTags ?? ''}`.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (combined.includes(kw)) score += 2; // AI visual match = 2pts per keyword
    }
    scores.set(img.listingId, (scores.get(img.listingId) ?? 0) + score);
  }

  for (const listing of titleMatches) {
    if (!scores.has(listing.id)) {
      scores.set(listing.id, 1); // text-only match = 1pt baseline
    }
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24)
    .map(([id]) => id);

  return { listingIds: ranked, queryDescription: description, queryTags: tags };
}
