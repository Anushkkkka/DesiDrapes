import { describe, expect, it } from 'vitest';
import { parseShoppingIntent } from '../../src/modules/ai/ai.service.js';

describe('parseShoppingIntent (AI stylist retrieval)', () => {
  it('maps people words to catalog categories', () => {
    expect(parseShoppingIntent('something for my husband').category).toBe('men');
    expect(parseShoppingIntent('outfit for the bride').category).toBe('women');
    expect(parseShoppingIntent('lehenga for a little girl')).toMatchObject({ category: 'kids', subcategory: 'Girls' });
  });

  it('extracts budgets', () => {
    expect(parseShoppingIntent('kurta under $100').maxPrice).toBe(100);
    expect(parseShoppingIntent('saree below 80 aud').maxPrice).toBe(80);
    expect(parseShoppingIntent('gown over 150').minPrice).toBe(150);
  });

  it('expands occasions into garment keywords', () => {
    const { keywords } = parseShoppingIntent('wedding outfit');
    expect(keywords).toEqual(expect.arrayContaining(['lehenga', 'sherwani']));
  });

  it('drops filler words from keywords', () => {
    const { keywords } = parseShoppingIntent('I want something with silk please');
    expect(keywords).toContain('silk');
    expect(keywords).not.toContain('want');
    expect(keywords).not.toContain('please');
  });
});
