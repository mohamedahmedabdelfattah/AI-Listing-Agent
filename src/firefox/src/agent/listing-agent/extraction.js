// AI Listing Agent — two-pass extraction/normalization (pure).
// Pass 1 normalizes list-card candidates; pass 2 merges detail-page data.
// Feature plan: Extraction. Design refs: §4.3.

/**
 * Normalize a raw candidate (list card or detail) into a partial canonical Listing.
 * @param {Object} raw
 * @param {{ pass?: 1|2, sourceUrl?: string }} [ctx]
 * @returns {Object}
 */
export function normalizeCandidate(raw, ctx = {}) {
  throw new Error('NotImplemented: normalizeCandidate');
}

/**
 * Merge pass-2 detail data into a pass-1 candidate, preferring higher-confidence evidence.
 * @param {Object} candidate
 * @param {Object} detail
 * @returns {Object}
 */
export function mergeDetail(candidate, detail) {
  throw new Error('NotImplemented: mergeDetail');
}
