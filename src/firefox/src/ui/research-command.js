// AI Listing Agent — /research slash-command parser (pure).
// Mirrors the watch-command.js template. Failure => { ok:false, error, usage }.
// Feature plan: Controller/wiring. Design refs: §10.

export const RESEARCH_COMMAND_USAGE =
  '/research <objective> — research listings matching the objective on the current site';

/**
 * Parse a raw `/research ...` command string.
 * @param {string} value
 * @returns {{ ok: true, objective: string, flags: Object } | { ok: false, error: string, usage: string }}
 */
export function parseResearchSlashCommand(value) {
  throw new Error('NotImplemented: parseResearchSlashCommand');
}
