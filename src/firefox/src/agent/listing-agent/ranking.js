// AI Listing Agent — transparent ranking (pure).
// Feature plan: Domain core. Design refs: §7 (explicit formula + breakdown).

/**
 * Compute a listing's ranking score and a human-readable breakdown.
 * @param {Object} listing
 * @param {import('./mission.js').ResearchMission} mission
 * @returns {{ score: number, breakdown: Array<{ factor: string, weight: number, contribution: number }> }}
 */
export function computeRanking(listing, mission) {
  throw new Error('NotImplemented: computeRanking');
}
