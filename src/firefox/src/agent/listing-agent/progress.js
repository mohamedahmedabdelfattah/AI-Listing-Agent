// AI Listing Agent — loop limits & progress tracking (pure).
// Feature plan: Controller. Design refs: §9 (limits, no-progress termination).

/** Default research loop limits (design §9). */
export const DEFAULT_LIMITS = Object.freeze({
  maxDurationMs: 10 * 60 * 1000, // 10 minutes
  maxPages: 20,
  maxListings: 300,
  noProgressPageThreshold: 2, // stop after N consecutive pages with no new unique listings
});

/**
 * Create a progress tracker for one research job.
 * @param {typeof DEFAULT_LIMITS} [limits]
 * @returns {{
 *   recordPage: (info: { newUnique: number, totalUnique: number, elapsedMs: number }) => void,
 *   snapshot: () => Object,
 *   shouldTerminate: () => { terminate: boolean, reason: string|null }
 * }}
 */
export function createProgressTracker(limits = DEFAULT_LIMITS) {
  throw new Error('NotImplemented: createProgressTracker');
}
