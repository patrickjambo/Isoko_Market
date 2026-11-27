import { describe, it, expect } from 'vitest';
import { extractVisualKeywords, parseVisionJson } from '@/lib/visual-search';

describe('visual-search: parseVisionJson', () => {
  it('parses clean JSON description and string tags', () => {
    const raw = JSON.stringify({
      description: 'Black smartphone with triple rear camera and cracked tempered glass protector',
      tags: 'smartphone, phone, telefoni, black, electronics, mobile',
    });
    const parsed = parseVisionJson(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.description).toContain('Black smartphone');
    expect(parsed?.tags).toContain('telefoni');
  });

  it('parses markdown-fenced JSON and array tags gracefully', () => {
    const raw = [
      '```json',
      '{',
      '  "description": "Red leather high heel women shoes",',
      '  "tags": ["high heels", "women shoes", "red", "inkweto"]',
      '}',
      '```',
    ].join('\n');
    const parsed = parseVisionJson(raw);
    expect(parsed).toEqual({
      description: 'Red leather high heel women shoes',
      tags: 'high heels, women shoes, red, inkweto',
    });
  });

  it('returns null on empty or malformed output', () => {
    expect(parseVisionJson('')).toBeNull();
    expect(parseVisionJson('not json at all')).toBeNull();
    expect(parseVisionJson('{"description": "", "tags": ""}')).toBeNull();
  });
});

describe('visual-search: extractVisualKeywords', () => {
  it('splits multi-word tags into searchable tokens instead of concatenating them', () => {
    const { keywords, suggestedQuery } = extractVisualKeywords(
      'This product is a black leather running shoe with white sole',
      'running shoes, black sneakers, inkweto, footwear',
    );

    expect(keywords).toContain('running');
    expect(keywords).toContain('shoes');
    expect(keywords).toContain('black');
    expect(keywords).toContain('sneakers');
    expect(keywords).toContain('inkweto');
    // Must never concatenate multi-word tags like "runningshoes"
    expect(keywords).not.toContain('runningshoes');
    expect(keywords).not.toContain('blacksneakers');
    // Stop words like "this", "product", "with" are excluded
    expect(keywords).not.toContain('this');
    expect(keywords).not.toContain('product');
    expect(keywords).not.toContain('with');
    expect(suggestedQuery).toBe('running shoes');
  });
});
