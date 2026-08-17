// AI Listing Agent — duplicate detection (pure).
// Feature plan: Persistence. Design refs: §8 (levels 1-2).

/**
 * Derive a stable source listing id from a listing (Level 1 key).
 * @param {Object} listing
 * @returns {string|null}
 */
export function sourceListingId(listing) {
  throw new Error('NotImplemented: sourceListingId');
}

/**
 * Return the duplicate level between two listings (0 = distinct, 1 = same id, 2 = near-duplicate).
 * @param {Object} a
 * @param {Object} b
 * @returns {0|1|2}
 */
export function isDuplicate(a, b) {
  throw new Error('NotImplemented: isDuplicate');
}

/**
 * Partition listings into unique and duplicate sets.
 * @param {Object[]} listings
 * @returns {{ unique: Object[], duplicates: Array<{ listing: Object, duplicateOf: string, level: 1|2 }> }}
 */
export function dedupeListings(listings) {
  throw new Error('NotImplemented: dedupeListings');
}
