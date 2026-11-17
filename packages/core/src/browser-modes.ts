import type { BrowserAccessMode, BrowserMode } from './computer.ts';

/**
 * Browser permission modes in Pitchcrew's own words, from most to least supervised. Types only, so
 * the renderer can import it; the agent gateway uses the same words to tell agents their mode.
 */
export const browserModeOrder = [
  'supervised',
  'autonomous',
  'edits',
  'auto',
  'full',
] as const satisfies readonly BrowserMode[];

export const browserModeLabels: Record<BrowserMode, string> = {
  supervised: 'Supervised',
  autonomous: 'Autonomous preparation',
  edits: 'Accept edits',
  auto: 'Auto',
  full: 'Full access',
};

/** For tight chips; the full label stays in titles and menus. */
export const browserModeShortLabels: Record<BrowserMode, string> = {
  ...browserModeLabels,
  autonomous: 'Autonomous',
};

/** One sentence each: what the agent does on its own and what still asks. */
export const browserModeSummaries: Record<BrowserMode, string> = {
  supervised: 'Every browser action asks for your approval.',
  autonomous:
    'On sites you allow for the task, browses and prepares recognized application forms. Everything else asks.',
  edits:
    'Browses pages and fills in forms on its own. Buttons, links, keys, dialogs, agreeing to terms and sending ask first.',
  auto: 'Browses, fills in forms and handles routine clicks and keys on its own. Asks before what looks like it could send, submit, delete, buy or change an account.',
  full: 'Does everything on its own, including moving multi-step forms to their next step, except what it recognizes as sending or posting, which asks first.',
};

/** What holds in every mode, for help text beside the summaries. */
export const browserModeLimits =
  'In every mode, the final submission and anything Pitchcrew recognizes as sending or posting an application, message, post or invitation asks first; recognizing it is best effort. Scheduled routines and requests from other apps stay supervised. Agents never type passwords, open private network pages or upload anything but your approved packet.';

export const isBrowserAccessMode = (mode: BrowserMode | undefined): mode is BrowserAccessMode =>
  mode === 'edits' || mode === 'auto' || mode === 'full';

/** Modes in which the server may approve actions without asking: shown with the automatic tray. */
export const browserModeActsAlone = (mode: BrowserMode | undefined) =>
  mode === 'autonomous' || isBrowserAccessMode(mode);
