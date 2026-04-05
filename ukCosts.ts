// src/lib/ukCosts.ts
export const VALID_CATEGORIES = [
  'kitchen', 'bathroom', 'electrics', 'plumbing',
  'heating', 'windows', 'doors', 'plastering',
  'decoration', 'flooring', 'contingency', 'fees',
] as const;

export type Category = (typeof VALID_CATEGORIES)[number];

export function assertValidCategory(category: string): asserts category is Category {
  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`Invalid category: "${category}". Valid: ${VALID_CATEGORIES.join(', ')}`);
  }
}
