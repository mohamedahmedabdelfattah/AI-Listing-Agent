// AI Listing Agent — research skill prompt builder (pure).
// The research loop is MODEL-DRIVEN: this prompt instructs the existing agent
// loop how to page through results with existing tools, what to extract, which
// filters to apply, the exact structured output shape, and when to stop.
// Feature plan: Controller. Design refs: §4 (pipeline), §9 (limits), §10.

/**
 * Build the research skill/system prompt that steers the model.
 * @param {import('./mission.js').ResearchMission} mission
 * @param {typeof import('./progress.js').DEFAULT_LIMITS} limits
 * @returns {string}
 */
export function buildResearchSkillPrompt(mission, limits) {
  throw new Error('NotImplemented: buildResearchSkillPrompt');
}
