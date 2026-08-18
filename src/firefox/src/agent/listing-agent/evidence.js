// AI Listing Agent — evidence model (pure).
// Feature plan: Extraction. Design refs: §5 (weighted average; mandatory attrs 2x).

/**
 * Build an evidence record for one extracted attribute.
 * @param {{ value: *, sourceText?: string, extractionMethod?: string, confidence?: number, verificationStatus?: string }} fields
 * @returns {Object}
 */
export function makeEvidence(fields) {
  throw new Error('NotImplemented: makeEvidence');
}

/**
 * Aggregate a listing's evidence into an overall confidence score (mandatory attrs weighted 2x).
 * @param {Object} listing
 * @param {import('./mission.js').ResearchMission} mission
 * @returns {number} 0..1
 */
export function aggregateConfidence(listing, mission) {
  throw new Error('NotImplemented: aggregateConfidence');
}
