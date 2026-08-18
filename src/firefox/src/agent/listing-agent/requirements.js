// AI Listing Agent — lenient eligibility evaluation (pure).
// Feature plan: Domain core. Design refs: §6 (PASS/FAIL/UNKNOWN_BLOCKED,
// strict_mandatory_unknown default false).

/**
 * Evaluate a single requirement against a listing.
 * @param {import('./mission.js').Requirement} requirement
 * @param {Object} listing
 * @returns {'PASS'|'FAIL'|'UNKNOWN'}
 */
export function evaluateRequirement(requirement, listing) {
  throw new Error('NotImplemented: evaluateRequirement');
}

/**
 * Evaluate a listing against a mission (lenient by default).
 * @param {Object} listing
 * @param {import('./mission.js').ResearchMission} mission
 * @param {{ strictMandatoryUnknown?: boolean }} [opts]
 * @returns {{ eligibility: 'PASS'|'FAIL'|'UNKNOWN_BLOCKED', perRequirement: Array<{ requirementId: string, status: 'PASS'|'FAIL'|'UNKNOWN' }> }}
 */
export function evaluateListing(listing, mission, opts = {}) {
  throw new Error('NotImplemented: evaluateListing');
}
