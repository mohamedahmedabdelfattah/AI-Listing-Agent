// AI Listing Agent — result export (pure).
// Feature plan: Export. Design refs: §12 (JSON + CSV).

/**
 * Serialize a research job and its listings to a JSON string.
 * @param {Object} job
 * @param {Object[]} listings
 * @returns {string}
 */
export function listingsToJson(job, listings) {
  throw new Error('NotImplemented: listingsToJson');
}

/**
 * Serialize listings to a CSV string (RFC-4180 quoting).
 * @param {Object[]} listings
 * @returns {string}
 */
export function listingsToCsv(listings) {
  throw new Error('NotImplemented: listingsToCsv');
}
