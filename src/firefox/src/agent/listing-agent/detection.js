// AI Listing Agent — collection/listing detection (pure).
// Level 0 = JSON-LD, Levels 1-2 = structural/model-derived boundaries.
// Feature plan: Detection. Design refs: §4.1.

/**
 * Extract listing-shaped entities from JSON-LD embedded in page HTML.
 * @param {string} html
 * @returns {Array<Object>}
 */
export function extractJsonLdListings(html) {
  throw new Error('NotImplemented: extractJsonLdListings');
}

/**
 * Detect candidate result collections from a normalized page model.
 * @param {Object} pageModel
 * @returns {Array<Object>}
 */
export function detectCollections(pageModel) {
  throw new Error('NotImplemented: detectCollections');
}

/**
 * Detect per-listing boundaries within one collection.
 * @param {Object} collection
 * @returns {Array<Object>}
 */
export function detectListingBoundaries(collection) {
  throw new Error('NotImplemented: detectListingBoundaries');
}
