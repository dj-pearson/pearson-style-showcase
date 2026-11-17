import type { Format, TrackKey } from './types.js';

/**
 * Which of the three formats a post takes. A feature post about a product
 * that has real screenshots shows them; otherwise the track alternates between
 * a text carousel and a single image, starting with the carousel.
 */
export function chooseFormat(
  _track: TrackKey,
  _product: string,
  hasScreenshots: boolean,
  isFeature: boolean,
  lastFormat: Format | null = null
): Format {
  if (hasScreenshots && isFeature) return 'product_carousel';
  return lastFormat === 'text_carousel' ? 'single_image' : 'text_carousel';
}

/** Slide-count bounds per format, shared by the writer's validation and its prompt. */
export const SLIDE_BOUNDS: Record<Format, { min: number; max: number }> = {
  text_carousel: { min: 5, max: 8 },
  single_image: { min: 1, max: 1 },
  product_carousel: { min: 4, max: 7 },
};
