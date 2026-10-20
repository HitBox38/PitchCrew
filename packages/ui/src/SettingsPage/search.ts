import type { SettingsSection } from './helpers.ts';
export interface SettingEntry {
  label: string;
  section: SettingsSection;
  target: string;
  keywords: string[];
}
export const settingEntries: SettingEntry[] = [
  {
    label: 'Appearance and theme',
    section: 'general',
    target: 'appearance-heading',
    keywords: ['light', 'dark', 'system', 'color'],
  },
  {
    label: 'Chat reading width',
    section: 'general',
    target: 'chat-reading-width',
    keywords: ['messages', 'comfortable', 'wide', 'full'],
  },
  {
    label: 'Notification sounds',
    section: 'general',
    target: 'notification-sounds',
    keywords: ['audio', 'mute', 'alerts'],
  },
  {
    label: 'Connected accounts',
    section: 'accounts',
    target: 'accounts-heading',
    keywords: ['github', 'google', 'gmail', 'drive', 'permissions', 'login'],
  },
  {
    label: 'Job sources',
    section: 'sources',
    target: 'job-sources-heading',
    keywords: ['boards', 'greenhouse', 'ashby', 'lever', 'comeet', 'workable', 'scan'],
  },
  {
    label: 'Runtime setup and updates',
    section: 'runtimes',
    target: 'runtime-heading',
    keywords: ['CLI', 'codex', 'claude', 'install', 'sign-in'],
  },
  {
    label: 'Automatic runtime update checks',
    section: 'runtimes',
    target: 'automatic-runtime-updates',
    keywords: ['CLI', 'daily', 'versions'],
  },
  {
    label: 'Writing preferences',
    section: 'writing',
    target: 'writing-heading',
    keywords: ['guide', 'style', 'writer', 'reviewer'],
  },
  {
    label: 'Learn from chat corrections',
    section: 'writing',
    target: 'writing-learning',
    keywords: ['writing', 'learning', 'automatic'],
  },
  {
    label: 'Packet rules',
    section: 'rules',
    target: 'packet-rules-heading',
    keywords: ['resume', 'word limit', 'bullets', 'warnings', 'validation', 'JSON'],
  },
  {
    label: 'Pitchcrew update checks',
    section: 'updates',
    target: 'automatic-updates',
    keywords: ['app', 'version', 'download', 'upgrade'],
  },
  {
    label: 'Agent and skill update checks',
    section: 'updates',
    target: 'automatic-skill-updates',
    keywords: ['instructions', 'imported', 'automatic'],
  },
  {
    label: 'Anonymous usage analytics',
    section: 'privacy',
    target: 'usage-analytics',
    keywords: ['telemetry', 'posthog', 'tracking', 'opt out'],
  },
  {
    label: 'Anonymous diagnostics',
    section: 'privacy',
    target: 'diagnostic-analytics',
    keywords: ['telemetry', 'errors', 'performance'],
  },
  {
    label: 'Masked session replay',
    section: 'privacy',
    target: 'session-replay',
    keywords: ['recording', 'privacy', 'opt in'],
  },
  {
    label: 'Workspace data folder',
    section: 'data',
    target: 'data-heading',
    keywords: ['local', 'files', 'backup', 'path', 'directory'],
  },
  {
    label: 'Background service',
    section: 'data',
    target: 'background-service-heading',
    keywords: ['startup', 'login', 'daemon', 'routines'],
  },
];
