// AI Listing Agent — mission parsing (pure; no DOM/browser globals).
// Parses a free-text research objective into a structured ResearchMission.
// Feature plan: Domain core. Design refs: §3 (data model), §10 (mission UX).

/**
 * @typedef {Object} Requirement
 * @property {string} id         stable slug, e.g. "furnished"
 * @property {string} attribute  canonical attribute name
 * @property {string} operator   "eq"|"gte"|"lte"|"in"|"exists"|"not"
 * @property {*}      value
 * @property {string} raw        original phrase from the objective
 */

/**
 * @typedef {Object} ResearchMission
 * @property {string}        objective
 * @property {Requirement[]} mandatory
 * @property {Requirement[]} preferred
 * @property {Requirement[]} exclusions
 * @property {string}        sourceDomain
 * @property {Object}        options
 */

/**
 * Parse a free-text objective into a structured mission.
 * @param {string} objective
 * @param {{ sourceDomain?: string, options?: Object }} [ctx]
 * @returns {ResearchMission}
 */
export function parseMission(objective, ctx = {}) {
  throw new Error('NotImplemented: parseMission');
}

/**
 * Validate a mission object.
 * @param {ResearchMission} mission
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateMission(mission) {
  throw new Error('NotImplemented: validateMission');
}
