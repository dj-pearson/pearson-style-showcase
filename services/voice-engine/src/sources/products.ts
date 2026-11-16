import type { Product } from '../types.js';

/** Where each product's public pages live. The engine reads nothing else about a product. */
export const PRODUCT_SITES: Record<Product, string> = {
  gradethread: 'https://gradethread.com',
  eatpal: 'https://tryeatpal.com',
  brikly: 'https://brikly.net',
  printyx: 'https://printyx.net',
  agentbio: 'https://agentbio.net',
};

export function isProduct(value: string): value is Product {
  return Object.prototype.hasOwnProperty.call(PRODUCT_SITES, value);
}
