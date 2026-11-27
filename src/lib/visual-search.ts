import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from './env';
import { prisma } from './prisma';

// Active multimodal Gemini models (matching src/lib/verification/ocr.ts which uses the same key).
// Ordered by latency and availability: gemini-3.5-flash-lite responds in <1.5s for images.
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
];

const VISION_PROMPT = `You are a product search assistant for Zenova, a marketplace in Rwanda.
Analyze this image and return a JSON object with:
1. "description": A clear, search-friendly description of the main product or service item shown (object type, color, shape, material, style, notable visual features, visible text/model if clearly legible). Write how a buyer searches.
2. "tags": 10-15 comma-separated single or short keywords covering product name, category, synonyms, color, material, and common French/Kinyarwanda terms if applicable (e.g. "phone, smartphone, telefoni, black, electronics").

Respond ONLY with valid JSON:
{"description":"...","tags":"..."}

Be accurate about visual characteristics. Never invent brand names that are not clearly visible.`;

const STOP_WORDS = new Set([
  'the', 'this', 'that', 'with', 'from', 'have', 'has', 'are', 'was', 'were',
  'for', 'and', 'but', 'not', 'you', 'your', 'its', 'one', 'two', 'item',
  'product', 'image', 'photo', 'picture', 'shows', 'showing', 'looks', 'like',
  'very', 'also', 'featuring', 'features', 'made', 'used', 'can', 'into',
  'les', 'des', 'une', 'pour', 'avec', 'dans', 'qui', 'est', 'sont', 'sur',
]);

export type VisionDescription = {
  description: string;
  tags: string;
};

/**
 * Pure parser for vision model output. Handles plain JSON, markdown code
 * fences, trailing prose, or `tags` returned as either a string or string[].
 */
export function parseVisionJson(rawText: string): VisionDescription | null {
  if (!rawText || !rawText.trim()) return null;

  // Strip optional ```json ... ``` wrappers before scanning for the JSON object
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      description?: unknown;
      tags?: unknown;
    };

    const description =
      typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 1000) : '';
    let tags = '';
    if (typeof parsed.tags === 'string') {
      tags = parsed.tags.trim().slice(0, 500);
    } else if (Array.isArray(parsed.tags)) {
      tags = parsed.tags
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter(Boolean)
        .join(', ')
        .slice(0, 500);
    }

    if (!description && !tags) return null;
    return {
      description: description || tags,
      tags: tags || description.split(/\s+/).slice(0, 8).join(', '),
    };
  } catch {
    return null;
  }
}

/**
 * Pure keyword extractor for matching vision descriptions against catalog text.
 * Splits multi-word tags into searchable words (instead of concatenating them),
 * strips punctuation/stop-words, and preserves tag priority.
 */
export function extractVisualKeywords(
  description: string,
  tags: string,
): {
  keywords: string[];
  suggestedQuery: string;
} {
  const tagPhrases = tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  // Pick a concise 1-2 word marketplace search query from the first meaningful tag
  const firstCleanTag = tagPhrases[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Split phrases AND description into individual alphanumeric/accented tokens
  const tokenize = (text: string) =>
    text
      .toLowerCase()
      .split(/[^a-z0-9\u00c0-\u024f]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  const orderedTokens = [
    ...tagPhrases.flatMap(tokenize),
    ...tokenize(description).slice(0, 50),
  ];

  const keywords = [...new Set(orderedTokens)].slice(0, 14);
  const suggestedQuery = firstCleanTag && firstCleanTag.length >= 2 ? firstCleanTag : (keywords[0] ?? '');

  return { keywords, suggestedQuery };
}

async function resolveImageInput(
  input: string | { bytes: ArrayBuffer; mimeType: string },
): Promise<{ base64: string; mimeType: string } | null> {
  if (typeof input !== 'string') {
    const mimeType =
      input.mimeType && input.mimeType.startsWith('image/') && input.mimeType !== 'image/heic' && input.mimeType !== 'image/heif'
        ? input.mimeType
        : 'image/jpeg';
    return {
      base64: Buffer.from(input.bytes).toString('base64'),
      mimeType,
    };
  }

  const targetUrl = input.startsWith('/')
    ? `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}${input}`
    : input;

  const imgRes = await fetch(targetUrl, { signal: AbortSignal.timeout(8_000) });
  if (!imgRes.ok) return null;
  const imgBuffer = await imgRes.arrayBuffer();
  const rawType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0]!.trim();
  const mimeType = rawType.startsWith('image/') ? rawType : 'image/jpeg';
  return {
    base64: Buffer.from(imgBuffer).toString('base64'),
    mimeType,
  };
}

export async function describeImageForSearchWithDiagnostics(
  input: string | { bytes: ArrayBuffer; mimeType: string },
): Promise<{
  result: VisionDescription | null;
  error: string | null;
}> {
  const apiErrors: string[] = [];

  let prepared: { base64: string; mimeType: string } | null = null;
  try {
    prepared = await resolveImageInput(input);
  } catch (err) {
    return {
      result: null,
      error: err instanceof Error ? err.message : 'Failed to read image data.',
    };
  }
  if (!prepared) {
    return { result: null, error: 'Could not load the provided image.' };
  }

  // ── 1. Google Gemini Vision (matches working OCR configuration) ───────────
  const geminiKey = env.GEMINI_API_KEY.trim();
  if (geminiKey) {
    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: VISION_PROMPT },
            { inlineData: { mimeType: prepared.mimeType, data: prepared.base64 } },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiKey,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(12_000),
          },
        );

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          // eslint-disable-next-line no-console
          console.error(`[visual-search] Gemini (${model}) HTTP ${res.status}:`, errText.slice(0, 200));
          apiErrors.push(`${model} (HTTP ${res.status})`);
          if (res.status === 400 || res.status === 401 || res.status === 403) break;
          continue;
        }

        const data = (await res.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text =
          data.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? '')
            .join('\n') ?? '';

        const parsed = parseVisionJson(text);
        if (parsed) {
          return { result: parsed, error: null };
        }
        apiErrors.push(`${model} (invalid response format)`);
      } catch (err) {
        apiErrors.push(`${model} (${err instanceof Error ? err.message : 'network error'})`);
      }
    }
  }

  // ── 2. Optional Anthropic Vision fallback ─────────────────────────────────
  const anthropicKey = env.ANTHROPIC_API_KEY.trim();
  if (anthropicKey) {
    const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
    const mediaType = validMediaTypes.includes(prepared.mimeType as (typeof validMediaTypes)[number])
      ? (prepared.mimeType as (typeof validMediaTypes)[number])
      : 'image/jpeg';

    try {
      const client = new Anthropic({ apiKey: anthropicKey });
      for (const model of ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022']) {
        try {
          const response = await client.messages.create({
            model,
            max_tokens: 600,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: { type: 'base64', media_type: mediaType, data: prepared.base64 },
                  },
                  { type: 'text', text: VISION_PROMPT },
                ],
              },
            ],
          });
          const textBlock = response.content.find((c) => c.type === 'text') as
            | Anthropic.TextBlock
            | undefined;
          const parsed = textBlock?.text ? parseVisionJson(textBlock.text) : null;
          if (parsed) return { result: parsed, error: null };
        } catch (err) {
          apiErrors.push(`${model} (${err instanceof Error ? err.message : 'error'})`);
        }
      }
    } catch {
      /* client init failed */
    }
  }

  const configured = Boolean(geminiKey || anthropicKey);
  return {
    result: null,
    error: configured
      ? `Visual analysis is temporarily unavailable (${apiErrors[0] ?? 'provider error'}). Please try again.`
      : 'Visual search is not configured yet. Add GEMINI_API_KEY in environment settings.',
  };
}

/**
 * Use Gemini vision to generate a text description and search tags for a product image.
 * Returns null if vision analysis fails.
 */
export async function describeImageForSearch(
  input: string | { bytes: ArrayBuffer; mimeType: string },
): Promise<VisionDescription | null> {
  const { result } = await describeImageForSearchWithDiagnostics(input);
  return result;
}

export type VisualSearchMatchResult =
  | {
      ok: true;
      listingIds: string[];
      alternativesUsed: boolean;
      queryDescription: string;
      queryTags: string;
      suggestedQuery: string;
    }
  | {
      ok: false;
      errorMessage: string;
    };

/**
 * Visual similarity search:
 * 1. Describe the query image with Gemini vision.
 * 2. Match ACTIVE listings (non-suspended sellers) via AI image labels, title,
 *    description, listing tags, and category names.
 * 3. Rank by visual + text relevance.
 * 4. If no close match exists, return nearest available active alternatives
 *    marked with `alternativesUsed: true`.
 */
export async function visualSearchListings(
  input: string | { bytes: ArrayBuffer; mimeType: string },
): Promise<VisualSearchMatchResult> {
  const { result, error } = await describeImageForSearchWithDiagnostics(input);
  if (!result) {
    return {
      ok: false,
      errorMessage: error ?? 'Could not analyse this image. Please try another photo.',
    };
  }

  const { description, tags } = result;
  const { keywords, suggestedQuery } = extractVisualKeywords(description, tags);
  const topKw = keywords.slice(0, 8);

  const activeListingWhere = {
    status: 'ACTIVE' as const,
    seller: { accountStatus: 'ACTIVE' as const },
  };

  if (topKw.length > 0) {
    // 1. Search AI-indexed cover images (safe even if columns are still warming up)
    let imgMatches: Array<{ listingId: string; aiTags: string | null; aiDescription: string | null }> = [];
    try {
      imgMatches = await prisma.listingImage.findMany({
        where: {
          position: 0,
          listing: activeListingWhere,
          OR: topKw.flatMap((kw) => [
            { aiTags: { contains: kw, mode: 'insensitive' as const } },
            { aiDescription: { contains: kw, mode: 'insensitive' as const } },
          ]),
        },
        select: { listingId: true, aiTags: true, aiDescription: true },
        take: 80,
      });
    } catch {
      imgMatches = [];
    }

    // 2. Search listing title, description, tags, and category names for immediate coverage
    const listingMatches = await prisma.listing.findMany({
      where: {
        ...activeListingWhere,
        OR: [
          { tags: { hasSome: topKw } },
          ...topKw.flatMap((kw) => [
            { title: { contains: kw, mode: 'insensitive' as const } },
            { description: { contains: kw, mode: 'insensitive' as const } },
            { category: { nameEn: { contains: kw, mode: 'insensitive' as const } } },
            { category: { nameRw: { contains: kw, mode: 'insensitive' as const } } },
            { category: { nameFr: { contains: kw, mode: 'insensitive' as const } } },
            { category: { slug: { contains: kw, mode: 'insensitive' as const } } },
          ]),
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        isFeatured: true,
        category: { select: { nameEn: true, nameRw: true, nameFr: true } },
      },
      take: 60,
    });

    const scores = new Map<string, number>();

    for (const img of imgMatches) {
      const tagStr = (img.aiTags ?? '').toLowerCase();
      const descStr = (img.aiDescription ?? '').toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (tagStr.includes(kw)) score += 3;
        else if (descStr.includes(kw)) score += 2;
      }
      if (score > 0) {
        scores.set(img.listingId, (scores.get(img.listingId) ?? 0) + score);
      }
    }

    for (const listing of listingMatches) {
      const titleLower = listing.title.toLowerCase();
      const descLower = listing.description.toLowerCase();
      const catLower = listing.category
        ? `${listing.category.nameEn} ${listing.category.nameRw} ${listing.category.nameFr}`.toLowerCase()
        : '';
      const tagSet = listing.tags.map((t) => t.toLowerCase());

      let score = 0;
      for (const kw of keywords) {
        if (titleLower.includes(kw)) score += 4;
        if (tagSet.some((t) => t.includes(kw))) score += 3;
        if (catLower.includes(kw)) score += 2;
        if (descLower.includes(kw)) score += 1;
      }
      if (listing.isFeatured) score += 0.5;

      if (score > 0) {
        scores.set(listing.id, (scores.get(listing.id) ?? 0) + score);
      }
    }

    const ranked = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([id]) => id);

    if (ranked.length > 0) {
      return {
        ok: true,
        listingIds: ranked,
        alternativesUsed: false,
        queryDescription: description,
        queryTags: tags,
        suggestedQuery,
      };
    }
  }

  // 3. No close visual/text match — surface nearest active products as alternatives
  const fallbackListings = await prisma.listing.findMany({
    where: activeListingWhere,
    orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
    take: 6,
    select: { id: true },
  });

  return {
    ok: true,
    listingIds: fallbackListings.map((l) => l.id),
    alternativesUsed: fallbackListings.length > 0,
    queryDescription: description,
    queryTags: tags,
    suggestedQuery,
  };
}
