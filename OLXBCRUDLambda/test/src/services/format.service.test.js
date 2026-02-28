import { describe, expect, it } from 'vitest';

import { formatConditions, formatSearchToHTML } from '../../../src/services/format.service.js';

describe('format.service', () => {
  it('formats search details to HTML with optional values and condition fallback', () => {
    const result = formatSearchToHTML({
      alias: 'bike',
      active: true,
      searchTerm: 'mountain bike',
      searchId: '15',
      condition: new Set([''])
    });

    expect(result).toContain('<b>ALIAS:</b> bike');
    expect(result).toContain('<b>IS ACTIVE:</b> Yes');
    expect(result).toContain('<b>CONDITION:</b> All');
    expect(result).not.toContain('<b>MIN PRICE:</b>');
  });

  it('returns all condition when input is missing', () => {
    expect(Array.from(formatConditions())).toEqual(['']);
  });

  it('filters unknown conditions and trims values', () => {
    expect(Array.from(formatConditions('new, invalid, used '))).toEqual(['new', 'used']);
  });

  it('falls back to all when only unknown conditions are provided', () => {
    expect(Array.from(formatConditions('invalid,all,fair'))).toEqual([]);
  });
});
