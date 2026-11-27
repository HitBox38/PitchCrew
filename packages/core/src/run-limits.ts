// Zod-free, safe to import from the UI bundle.

/**
 * Every ordinary production runtime turn stops this long after it starts. Drafting, research and
 * high-effort reasoning need the same budget as browser work. Workflow runs set their deadline a
 * moment after `startedAt`, so `startedAt + runtimeTimeLimit` slightly under-estimates the end:
 * show it as "about HH:MM", never as a guaranteed time.
 */
export const runtimeTimeLimit = 30 * 60 * 1000;
