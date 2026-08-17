// AI Listing Agent — filter planning (pure).
// Maps mission requirements onto a site's advertised filter capabilities.
// Feature plan: Domain core. Design refs: §4.2.

/**
 * Produce a filter plan from a mission and the site's filter capabilities.
 * @param {import('./mission.js').ResearchMission} mission
 * @param {Array<{ attribute: string, type: string, values?: any[] }>} capabilities
 * @returns {{ filters: Array<{ attribute: string, value: any }>, unmapped: import('./mission.js').Requirement[] }}
 */
export function planFilters(mission, capabilities) {
  throw new Error('NotImplemented: planFilters');
}
