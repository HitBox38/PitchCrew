import { recentKey } from './constants.ts';

export function readRecent(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(recentKey) ?? '[]');
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}
