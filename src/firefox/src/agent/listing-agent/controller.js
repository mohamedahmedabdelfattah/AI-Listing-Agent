// AI Listing Agent — model-driven research controller (pure orchestrator).
// Dependency-injected so it stays Node-importable and unit-testable: it builds
// the skill prompt, starts a model-driven run via injected `startAgentRun`, and
// post-processes the model's extracted output through the pure pipeline
// (detection -> extraction -> evidence -> requirements -> ranking -> dedup),
// persisting via injected `persistence`. No background.js dependency.
// Feature plan: Controller. Design refs: §4, §9, §11.

/**
 * @typedef {Object} ControllerDeps
 * @property {(prompt: string, opts: Object) => Promise<Object>} startAgentRun  starts a model-driven agent run
 * @property {Object} persistence  the persistence module (or a compatible fake)
 * @property {() => number} now     injectable clock (ms); defaults to Date.now at call sites, not module load
 */

/**
 * Create a research controller bound to injected dependencies.
 * @param {ControllerDeps} deps
 * @returns {{ run: (mission: import('./mission.js').ResearchMission, options?: Object) => Promise<Object> }}
 */
export function createResearchController(deps) {
  throw new Error('NotImplemented: createResearchController');
}
