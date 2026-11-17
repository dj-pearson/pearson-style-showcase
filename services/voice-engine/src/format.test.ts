import { describe, expect, it } from 'vitest';
import { chooseFormat } from './format.js';

describe('chooseFormat', () => {
  it('uses the product carousel only for a feature post on a product with screenshots', () => {
    expect(chooseFormat('gradethread', 'gradethread', true, true, 'text_carousel')).toBe(
      'product_carousel'
    );
    expect(chooseFormat('gradethread', 'gradethread', false, true, null)).toBe('text_carousel');
    expect(chooseFormat('gradethread', 'gradethread', true, false, null)).toBe('text_carousel');
  });

  it('alternates text carousel and single image by the last format', () => {
    expect(chooseFormat('eatpal', 'eatpal', false, false, null)).toBe('text_carousel');
    expect(chooseFormat('eatpal', 'eatpal', false, false, 'text_carousel')).toBe('single_image');
    expect(chooseFormat('eatpal', 'eatpal', false, false, 'single_image')).toBe('text_carousel');
    expect(chooseFormat('eatpal', 'eatpal', false, false, 'product_carousel')).toBe(
      'text_carousel'
    );
  });
});
