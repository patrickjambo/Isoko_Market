import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

export interface IdExtractionResult {
  fullName: string | null;
  idNumber: string | null;
  country: string | null;
  confidence: number; // 0.0 to 1.0
  rawText: string;
  needsManualReview: boolean;
  reviewReasons: string[];
}

export interface RwandanIdValidation {
  valid: boolean;
  normalizedId?: string;
  birthYear?: number;
  genderIndicator?: 'MALE' | 'FEMALE' | 'OTHER';
  isCitizen?: boolean;
  reason?: string;
}

/**
 * Validates a 16-digit Rwandan National Identification Number (Indangamuntu).
 * Format: 1 YYYY [7|8] XXXXXXX X XX
 * Digit 1: 1 = Rwandan Citizen, 2 = Foreigner / Refugee
 * Digits 2-5: Year of Birth
 * Digit 6: 8 = Male, 7 = Female
 * Remaining: unique serial & check digits
 */
export function validateRwandanIdNumber(rawId: string): RwandanIdValidation {
  if (!rawId) {
    return { valid: false, reason: 'ID number is empty' };
  }

  const clean = rawId.replace(/[\s\-_.]/g, '');

  if (!/^\d{16}$/.test(clean)) {
    return {
      valid: false,
      reason: `Expected 16 digits, got ${clean.length} digits`,
    };
  }

  const firstDigit = clean[0];
  const yearStr = clean.slice(1, 5);
  const genderDigit = clean[5];

  const birthYear = parseInt(yearStr, 10);
  const currentYear = new Date().getFullYear();

  if (isNaN(birthYear) || birthYear < 1910 || birthYear > currentYear) {
    return {
      valid: false,
      reason: `Invalid birth year encoded in ID: ${yearStr}`,
    };
  }

  const isCitizen = firstDigit === '1';
  const genderIndicator =
    genderDigit === '8' ? 'MALE' : genderDigit === '7' ? 'FEMALE' : 'OTHER';

  return {
    valid: true,
    normalizedId: clean,
    birthYear,
    genderIndicator,
    isCitizen,
  };
}

/**
 * Heuristic text parser that extracts Name, Rwandan 16-digit ID, and Country
 * from raw OCR text. Used as primary deterministic extractor or fallback.
 */
export function parseIdTextHeuristically(text: string, userFullName?: string): IdExtractionResult {
  const reviewReasons: string[] = [];
  let confidence = 0.0;
  let country: string | null = null;
  let idNumber: string | null = null;
  let fullName: string | null = null;

  const normalizedText = text.trim();

  // 1. Country Recognition - specific recognition for Republic of Rwanda
  const rwandaPattern = /(republic\s+of\s+rwanda|repubulika\s+y['’]u\s+rwanda|r[eé]publique\s+du\s+rwanda|rwanda)/i;
  if (rwandaPattern.test(normalizedText)) {
    country = 'Rwanda';
    confidence += 0.35;
  } else {
    // Check other EAC / international countries if present
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

    if (country) {
      confidence += 0.25;
    } else {
      reviewReasons.push('Issuing country could not be identified from document');
    }
  }

  // 2. Rwandan 16-digit ID Number extraction
  // Handles formatted strings: "1 1998 8 0012345 0 24" or unspaced: "1199880012345024"
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
    // Look for any 16-digit sequence
    const any16 = normalizedText.match(/\b(\d{16})\b/);
    if (any16 && any16[1]) {
      idNumber = any16[1];
      confidence += 0.25;
      reviewReasons.push('16-digit sequence found but doesn\'t strictly match Rwandan national ID structure');
    } else {
      reviewReasons.push('National ID number could not be found or read clearly');
    }
  }

  // 3. Name Extraction
  // Look for label markers: "Amazina / Names / Noms", "Names:", "Nom:", "Amazina:"
  const nameLabelMatch = normalizedText.match(
    /(?:amazina|names?|noms?|holder['’]?s?\s*name)[:\s]+([A-Z\s\-]{3,40})/i
  );

  if (nameLabelMatch && nameLabelMatch[1]) {
    const rawName = nameLabelMatch[1].trim().replace(/\n+/g, ' ');
    if (rawName.length >= 3) {
      fullName = rawName;
      confidence += 0.2;
    }
  }

  // If name label was not explicitly found, but applicant's registered name appears in OCR text
  if (!fullName && userFullName) {
    const parts = userFullName.trim().split(/\s+/).filter((p) => p.length >= 3);
    const matchesAll = parts.length > 0 && parts.every((p) => new RegExp(`\\b${p}\\b`, 'i').test(normalizedText));
    if (matchesAll) {
      fullName = userFullName;
      confidence += 0.2;
    }
  }

  if (!fullName) {
    reviewReasons.push('Full name could not be automatically extracted');
  }

  const needsManualReview = confidence < 0.75 || !idNumber || !country;

  return {
    fullName,
    idNumber,
    country,
    confidence: Math.min(1.0, Math.round(confidence * 100) / 100),
    rawText: text,
    needsManualReview,
    reviewReasons,
  };
}

/**
 * Extracts identity details from an uploaded ID document.
 * Leverages Claude Vision when ANTHROPIC_API_KEY is configured,
 * combined with deterministic Rwandan ID validation and fallback parsing.
 */
export async function extractIdDocumentData(options: {
  imageBuffer?: Buffer;
  mimeType?: string;
  userFullName?: string;
  fallbackText?: string;
}): Promise<IdExtractionResult> {
  const { imageBuffer, mimeType = 'image/jpeg', userFullName, fallbackText } = options;

  // If Anthropic Claude AI is configured and an image buffer is provided
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && imageBuffer && imageBuffer.length > 0) {
    try {
      const client = new Anthropic({ apiKey });
      const validMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
      const mediaType = validMediaTypes.includes(mimeType as any)
        ? (mimeType as (typeof validMediaTypes)[number])
        : 'image/jpeg';

      const base64Data = imageBuffer.toString('base64');

      const response = await client.messages.create({
        model: process.env.AI_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        system: `You are an official Identity Verification OCR engine for the Zenova platform in Rwanda.
Your role is to accurately extract identity information from uploaded National ID cards or official passports.

Extract strictly:
1. fullName: The full legal name of the cardholder (look for Amazina / Names / Noms).
2. idNumber: The national identity number. For Rwandan National IDs (Indangamuntu), this is a 16-digit number starting with 1 or 2 (e.g. "1 1995 8 0012345 0 24" or "1199580012345024"). Strip all spaces and return pure 16 digits.
3. country: Issuing country. If "Republic of Rwanda", "Repubulika y'u Rwanda", or Rwandan national coat of arms is detected, return "Rwanda". Otherwise return the detected issuing country name.
4. confidence: A score from 0.0 to 1.0 based on visual clarity and legibility.
5. rawText: The full raw text read from the document.
6. needsManualReview: true if text is blurry, truncated, obscured, or confidence is below 0.75, false if clearly legible.
7. reviewReasons: Array of strings explaining any issues or reasons for manual review.

Respond ONLY with valid JSON in this exact structure:
{
  "fullName": string | null,
  "idNumber": string | null,
  "country": string | null,
  "confidence": number,
  "rawText": string,
  "needsManualReview": boolean,
  "reviewReasons": string[]
}`,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: `Extract the Full Name, National ID Number, and Country from this document. The registered user name is "${userFullName || 'Unknown'}". Return strictly valid JSON.`,
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((c) => c.type === 'text') as Anthropic.TextBlock | undefined;
      if (textBlock && textBlock.text) {
        const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);

          // Normalize ID number
          let idNum = parsed.idNumber ? String(parsed.idNumber).replace(/\s+/g, '') : null;
          let needsReview = Boolean(parsed.needsManualReview);
          const reasons: string[] = Array.isArray(parsed.reviewReasons) ? parsed.reviewReasons : [];

          if (idNum) {
            const val = validateRwandanIdNumber(idNum);
            if (!val.valid) {
              needsReview = true;
              reasons.push(val.reason || 'Rwandan ID number format validation failed');
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
            country: parsed.country || 'Rwanda',
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
            rawText: parsed.rawText || textBlock.text,
            needsManualReview: needsReview,
            reviewReasons: reasons,
          };
        }
      }
    } catch (err) {
      console.error('[ocr] Anthropic vision OCR error, falling back to heuristic engine:', err);
    }
  }

  // Fallback heuristic extraction
  const sourceText = fallbackText || (imageBuffer ? imageBuffer.toString('utf8', 0, Math.min(imageBuffer.length, 2048)) : '');
  return parseIdTextHeuristically(sourceText, userFullName);
}
