/**
 * Type Guards for Array Normalization
 * 
 * Safely converts unknown[] to string[] using type guards
 * Prevents TypeScript build failures without using unsafe casts
 */

/**
 * Ensures an array of unknown values is narrowed to string[]
 * Filters out non-string values and empty strings
 */
export function ensureStringArray(values: unknown[]): string[] {
  return values.filter(
    (v): v is string => typeof v === 'string' && v.trim().length > 0
  );
}

/**
 * Ensures an array of unknown values is narrowed to string[]
 * Allows empty strings (doesn't filter them out)
 */
export function ensureStringArrayAllowEmpty(values: unknown[]): string[] {
  return values.filter(
    (v): v is string => typeof v === 'string'
  );
}

/**
 * Creates a unique array of strings from an unknown array
 * Combines Set deduplication with type narrowing
 */
export function uniqueStringArray(values: unknown[]): string[] {
  const unique = Array.from(new Set(values));
  return ensureStringArray(unique);
}

