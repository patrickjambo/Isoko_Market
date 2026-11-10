import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';
import { validateRwandanIdNumber, type RwandanIdValidation } from './id-validator';

export { validateRwandanIdNumber, type RwandanIdValidation };

export interface IdExtractionResult {
  fullName: string | null;
  idNumber: string | null;
  country: string | null;
  confidence: number; // 0.0 to 1.0
  rawText: string;
  needsManualReview: boolean;
  reviewReasons: string[];
}

// ── OCR system prompt (shared by all vision providers) ───────────────────────
const OCR_SYSTEM_PROMPT = `You are an official Identity Verification OCR engine for the Zenova platform in Rwanda.
Extract ONLY what is clearly visible on the ID card. Do not guess or infer data not on the card.

Extract these fields and return ONLY valid JSON (no markdown, no explanation):
{
  "fullName": "Full legal name exactly as printed under Amazina / Names / Noms",
  "idNumber": "16-digit national ID number with all spaces removed (Rwandan IDs start with 1 or 2)",
  "country": "Rwanda if you see Republic of Rwanda / Repubulika y'u Rwanda / Rwandan coat of arms, otherwise the detected country",
  "confidence": 0.0 to 1.0 based on image clarity and legibility,
  "rawText": "All text you can read from the document verbatim",
  "needsManualReview": true if anything is blurry/unclear or confidence < 0.75,
  "reviewReasons": ["array of strings explaining any issues found"]
}`;

// ── Shared: normalise a raw parsed OCR JSON object ───────────────────────────
function normaliseOcrJson(
  parsed: Record<string, unknown>,
  rawFallback: string
): IdExtractionResult {
  let idNum = parsed.idNumber ? String(parsed.idNumber).replace(/\s+/g, '') : null;
  let needsReview = Boolean(parsed.needsManualReview);
  const reasons: string[] = Array.isArray(parsed.reviewReasons)
    ? (parsed.reviewReasons as string[])
    : [];

  if (idNum) {
    const val = validateRwandanIdNumber(idNum);
    if (!val.valid) {
      needsReview = true;
      reasons.push(val.reason || 'Rwandan ID number validation failed');
    } else {
      idNum = val.normalizedId || idNum;
    }
  } else {
    needsReview = true;
    reasons.push('National ID number could not be extracted');
  }

  if (!parsed.country) {
    needsReview = true;
    reasons.push('Issuing country could not be identified');
  }

  return {
    fullName: (parsed.fullName as string) || null,
    idNumber: idNum,
    country: (parsed.country as string) || null,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
    rawText: (parsed.rawText as string) || rawFallback,
    needsManualReview: needsReview,
    reviewReasons: reasons,
  };
}

// ── Shared: attempt to parse a JSON response string ─────────────────────────
function tryParseOcrJson(text: string, rawFallback: string): IdExtractionResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    return normaliseOcrJson(parsed, rawFallback);
  } catch {
    return null;
  }
}

/**
 * Heuristic text parser — works on actual readable text (not binary bytes).
 * Used as a last resort when only plain text is available (e.g. Google Vision).
 */
export function parseIdTextHeuristically(text: string, userFullName?: string): IdExtractionResult {
  const reviewReasons: string[] = [];
  let confidence = 0.0;
  let country: string | null = null;
  let idNumber: string | null = null;
  let fullName: string | null = null;

  const normalizedText = text.trim();
  if (!normalizedText) {
    return {
      fullName: null,
      idNumber: null,
      country: null,
      confidence: 0,
      rawText: text,
      needsManualReview: true,
      reviewReasons: ['No text available for heuristic extraction — image requires visual OCR'],
    };
  }

  // 1. Country Recognition
  const rwandaPattern =
    /(republic\s+of\s+rwanda|repubulika\s+y[''`]u\s+rwanda|r[eé]publique\s+du\s+rwanda|rwanda)/i;
  if (rwandaPattern.test(normalizedText)) {
    country = 'Rwanda';
    confidence += 0.35;
  } else {
    if (/uganda/i.test(normalizedText)) country = 'Uganda';
    else if (/kenya/i.test(normalizedText)) country = 'Kenya';
    else if (/burundi/i.test(normalizedText)) country = 'Burundi';
    else if (/(congo|drc)/i.test(normalizedText)) country = 'DR Congo';
    else if (/tanzania/i.test(normalizedText)) country = 'Tanzania';
    if (country) confidence += 0.25;
    else reviewReasons.push('Issuing country could not be identified from document');
  }

  // 2. Rwandan 16-digit ID Number
  const spacedIdMatch = normalizedText.match(/\b([12]\s*\d{4}\s*[78]\s*\d{7}\s*\d\s*\d{2})\b/);
  const strict16Match = normalizedText.match(/\b([12]\d{15})\b/);
  const matchedId = spacedIdMatch ? spacedIdMatch[1] : strict16Match ? strict16Match[1] : null;

  if (matchedId) {
    const cleanId = matchedId.replace(/\s+/g, '');
    const validation = validateRwandanIdNumber(cleanId);
    if (validation.valid) {
      idNumber = cleanId;
      confidence += 0.45;
    } else {
      idNumber = cleanId;
      confidence += 0.2;
      reviewReasons.push(`Extracted ID number failed checksum/structure: ${validation.reason}`);
    }
  } else {
    const any16 = normalizedText.match(/\b(\d{16})\b/);
    if (any16?.[1]) {
      idNumber = any16[1];
      confidence += 0.25;
      reviewReasons.push('16-digit sequence found but may not be a valid Rwandan NID');
    } else {
      reviewReasons.push('National ID number could not be found');
    }
  }

  // 3. Name from label
  const nameLabelMatch = normalizedText.match(
    /(?:amazina|names?|noms?|holder['`]?s?\s*name)[:\s]+([A-Z\s\-]{3,40})/i
  );
  if (nameLabelMatch?.[1]) {
    const rawName = nameLabelMatch[1].trim().replace(/\n+/g, ' ');
    if (rawName.length >= 3) {
      fullName = rawName;
      confidence += 0.2;
    }
  }

  // Cross-check: account name appears in OCR text
  if (!fullName && userFullName) {
    const parts = userFullName.trim().split(/\s+/).filter((p) => p.length >= 3);
    const matchesAll =
      parts.length > 0 && parts.every((p) => new RegExp(`\\b${p}\\b`, 'i').test(normalizedText));
    if (matchesAll) {
      fullName = userFullName;
      confidence += 0.2;
    }
  }

  if (!fullName) reviewReasons.push('Full name could not be automatically extracted');

  return {
    fullName,
    idNumber,
    country,
    confidence: Math.min(1.0, Math.round(confidence * 100) / 100),
    rawText: text,
    needsManualReview: confidence < 0.75 || !idNumber || !country,
    reviewReasons,
  };
}

/**
 * Extracts identity details from an uploaded ID document image.
 *
 * Priority order (use the first configured key):
 * 1. Google Gemini Vision  — FREE (1,500 req/day) via GEMINI_API_KEY
 * 2. Anthropic Claude Vision — Paid, via ANTHROPIC_API_KEY
 * 3. Google Cloud Vision     — 1,000/month free, via GOOGLE_VISION_API_KEY
 * 4. Manual review flag      — No API → admin fills fields manually
 */
export async function extractIdDocumentData(options: {
  imageBuffer?: Buffer;
  mimeType?: string;
  userFullName?: string;
  fallbackText?: string;
}): Promise<IdExtractionResult> {
  const { imageBuffer, mimeType = 'image/jpeg', userFullName, fallbackText } = options;

  // ── 1. Google Gemini Vision (FREE — 1,500 req/day) ──────────────────────
  const geminiKey = env.GEMINI_API_KEY;
  if (geminiKey && imageBuffer && imageBuffer.length > 0) {
    try {
      const b64 = imageBuffer.toString('base64');
      // Gemini 2.0 Flash — v1 stable API, correct request format
      const body = {
        systemInstruction: { parts: [{ text: OCR_SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: mimeType, data: b64 } },
              {
                text: `Extract the identity information from this ID card. The registered account name is "${userFullName || 'Unknown'}". Return ONLY JSON.`,
              },
            ],
          },
        ],
        generationConfig: { temperature: 0, maxOutputTokens: 600 },
      };

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(25000),
        }
      );

      if (res.ok) {
        const gm = await res.json() as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const text = gm.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (text.trim()) {
          const result = tryParseOcrJson(text, text);
          if (result) {
            console.log('[ocr] Gemini Vision success');
            return result;
          }
        }
      } else {
        const errText = await res.text();
        console.error('[ocr] Gemini Vision HTTP error:', res.status, errText.slice(0, 300));
      }
    } catch (err) {
      console.error('[ocr] Gemini Vision error:', err);
    }
  }

  // ── 2. Anthropic Claude Vision (paid fallback) ──────────────────────────
  const anthropicKey = env.ANTHROPIC_API_KEY;
  if (anthropicKey && imageBuffer && imageBuffer.length > 0) {
    try {
      const client = new Anthropic({ apiKey: anthropicKey });
      const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
      const mediaType = validMediaTypes.includes(mimeType as (typeof validMediaTypes)[number])
        ? (mimeType as (typeof validMediaTypes)[number])
        : 'image/jpeg';

      const response = await client.messages.create({
        model: env.AI_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 600,
        system: OCR_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: imageBuffer.toString('base64') },
              },
              {
                type: 'text',
                text: `Extract the identity information from this ID card. The registered account name is "${userFullName || 'Unknown'}". Return ONLY JSON.`,
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((c) => c.type === 'text') as
        | Anthropic.TextBlock
        | undefined;
      if (textBlock?.text) {
        const result = tryParseOcrJson(textBlock.text, textBlock.text);
        if (result) {
          console.log('[ocr] Anthropic Vision success');
          return result;
        }
      }
    } catch (err) {
      console.error('[ocr] Anthropic Vision error:', err);
    }
  }

  // ── 3. Google Cloud Vision (text detection, 1,000/month free) ───────────
  const googleKey = env.GOOGLE_VISION_API_KEY;
  if (googleKey && imageBuffer && imageBuffer.length > 0) {
    try {
      const b64 = imageBuffer.toString('base64');
      const res = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${googleKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{ image: { content: b64 }, features: [{ type: 'TEXT_DETECTION' }] }],
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const gv = await res.json() as {
          responses?: Array<{ fullTextAnnotation?: { text?: string } }>;
        };
        const rawText = gv.responses?.[0]?.fullTextAnnotation?.text ?? '';
        if (rawText.trim()) {
          console.log('[ocr] Google Cloud Vision success');
          return parseIdTextHeuristically(rawText, userFullName);
        }
      }
    } catch (err) {
      console.error('[ocr] Google Cloud Vision error:', err);
    }
  }

  // ── 4. Plain text fallback (e.g. PDF or metadata) ──────────────────────
  if (fallbackText?.trim()) {
    return parseIdTextHeuristically(fallbackText, userFullName);
  }

  // ── 5. No vision API configured — flag for manual admin review ──────────
  // We do NOT parse raw binary image bytes as UTF-8 (produces garbage).
  // Admin must manually enter the correct information from the document.
  return {
    fullName: null,
    idNumber: null,
    country: 'Rwanda',
    confidence: 0,
    rawText: '',
    needsManualReview: true,
    reviewReasons: [
      'No OCR API configured — add GEMINI_API_KEY (free) to Vercel environment variables',
      'Visit https://aistudio.google.com/app/apikey to get a free Gemini API key',
      'Admin must manually verify and enter the name and ID number from the document',
    ],
  };
}
