import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
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

/**
 * Heuristic text parser — works on actual text (not raw binary image bytes).
 * Used when Claude Vision is unavailable or for processing text extracted from
 * the filename / metadata signals.
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
  const rwandaPattern = /(republic\s+of\s+rwanda|repubulika\s+y['']u\s+rwanda|r[eé]publique\s+du\s+rwanda|rwanda)/i;
  if (rwandaPattern.test(normalizedText)) {
    country = 'Rwanda';
    confidence += 0.35;
  } else {
    const uganda = /uganda/i.test(normalizedText);
    const kenya = /kenya/i.test(normalizedText);
    const burundi = /burundi/i.test(normalizedText);
    const drc = /(congo|drc)/i.test(normalizedText);
    const tanzania = /tanzania/i.test(normalizedText);
    if (uganda) country = 'Uganda';
    else if (kenya) country = 'Kenya';
    else if (burundi) country = 'Burundi';
    else if (drc) country = 'DR Congo';
    else if (tanzania) country = 'Tanzania';
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

  // 3. Name Extraction from text labels
  const nameLabelMatch = normalizedText.match(
    /(?:amazina|names?|noms?|holder['']?s?\s*name)[:\s]+([A-Z\s\-]{3,40})/i
  );
  if (nameLabelMatch?.[1]) {
    const rawName = nameLabelMatch[1].trim().replace(/\n+/g, ' ');
    if (rawName.length >= 3) {
      fullName = rawName;
      confidence += 0.2;
    }
  }

  // Cross-check: if registered name appears in OCR text
  if (!fullName && userFullName) {
    const parts = userFullName.trim().split(/\s+/).filter((p) => p.length >= 3);
    const matchesAll = parts.length > 0 && parts.every((p) => new RegExp(`\\b${p}\\b`, 'i').test(normalizedText));
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
 * Priority order:
 * 1. Anthropic Claude Vision (best accuracy, requires ANTHROPIC_API_KEY)
 * 2. Google Cloud Vision (alternative, requires GOOGLE_VISION_API_KEY)
 * 3. Manual review flag (no API — admin fills in fields manually)
 *
 * When no vision API is configured, we do NOT try to parse binary image bytes
 * as text (that produced garbage). Instead we return a clean "needs manual
 * review" result so the admin knows to fill the fields themselves.
 */
export async function extractIdDocumentData(options: {
  imageBuffer?: Buffer;
  mimeType?: string;
  userFullName?: string;
  fallbackText?: string;
}): Promise<IdExtractionResult> {
  const { imageBuffer, mimeType = 'image/jpeg', userFullName, fallbackText } = options;

  // ── 1. Anthropic Claude Vision (primary) ───────────────────────────────
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey && imageBuffer && imageBuffer.length > 0) {
    try {
      const client = new Anthropic({ apiKey: anthropicKey });
      const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
      const mediaType = validMediaTypes.includes(mimeType as (typeof validMediaTypes)[number])
        ? (mimeType as (typeof validMediaTypes)[number])
        : 'image/jpeg';

      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 600,
        system: `You are an official Identity Verification OCR engine for the Zenova platform in Rwanda.
Extract ONLY what is clearly visible on the ID card. Do not guess or infer data not on the card.

Extract:
1. fullName: Full legal name from "Amazina / Names / Noms" field. Return EXACTLY as printed.
2. idNumber: The national ID number. For Rwandan IDs (Indangamuntu) it starts with 1 or 2 and is 16 digits (e.g. "1199880012345024"). Strip all spaces, return pure digits.
3. country: If you see "Republic of Rwanda", "Repubulika y'u Rwanda", or Rwandan coat of arms → return "Rwanda". Otherwise return the detected country.
4. confidence: 0.0–1.0 based on image clarity.
5. rawText: All text you can read from the document.
6. needsManualReview: true if anything is blurry/unclear or confidence < 0.75.
7. reviewReasons: Array explaining any issues.

Respond with ONLY valid JSON, no markdown:`,
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

      const textBlock = response.content.find((c) => c.type === 'text') as Anthropic.TextBlock | undefined;
      if (textBlock?.text) {
        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          let idNum = parsed.idNumber ? String(parsed.idNumber).replace(/\s+/g, '') : null;
          let needsReview = Boolean(parsed.needsManualReview);
          const reasons: string[] = Array.isArray(parsed.reviewReasons) ? parsed.reviewReasons : [];

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
            fullName: parsed.fullName || null,
            idNumber: idNum,
            country: parsed.country || null,
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
            rawText: parsed.rawText || textBlock.text,
            needsManualReview: needsReview,
            reviewReasons: reasons,
          };
        }
      }
    } catch (err) {
      console.error('[ocr] Anthropic Vision error:', err);
    }
  }

  // ── 2. Google Cloud Vision (alternative) ──────────────────────────────
  const googleKey = process.env.GOOGLE_VISION_API_KEY;
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
        const gv = await res.json();
        const rawText = gv.responses?.[0]?.fullTextAnnotation?.text || '';
        if (rawText.trim()) {
          return parseIdTextHeuristically(rawText, userFullName);
        }
      }
    } catch (err) {
      console.error('[ocr] Google Vision error:', err);
    }
  }

  // ── 3. Fallback text source (e.g. from PDF or provided text) ──────────
  if (fallbackText?.trim()) {
    return parseIdTextHeuristically(fallbackText, userFullName);
  }

  // ── 4. No vision API configured — flag for manual admin review ─────────
  // IMPORTANT: We do NOT parse raw binary image bytes as UTF-8 (that produces
  // garbage data). The admin will manually enter the correct information.
  return {
    fullName: null,
    idNumber: null,
    country: 'Rwanda', // default for the platform context
    confidence: 0,
    rawText: '',
    needsManualReview: true,
    reviewReasons: [
      'No OCR API configured (ANTHROPIC_API_KEY or GOOGLE_VISION_API_KEY required for automatic extraction)',
      'Please configure an AI Vision API key in environment variables to enable automatic extraction',
      'Admin must manually verify and enter the name and ID number from the document',
    ],
  };
}
