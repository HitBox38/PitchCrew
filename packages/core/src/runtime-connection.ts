import type { RuntimeId } from './states.ts';

/** User-only authentication settings. Secret values are write-only. */
export interface RuntimeConnectionField {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  /** Declared native values for a non-secret selection. */
  choices?: string[];
  secret: boolean;
}
export interface RuntimeConnectionFieldState extends RuntimeConnectionField {
  source: 'saved' | 'inherited' | 'disabled' | 'unset';
  configured: boolean;
  /** Present only for non-secret fields. */
  value?: string;
  /** An inherited non-secret value failed validation and was omitted from the response. */
  invalidValue?: { code: 'invalid_environment'; message: string };
}
export interface RuntimeConnectionState {
  runtime: RuntimeId;
  revision: string;
  fields: RuntimeConnectionFieldState[];
  busyReasons: string[];
  readError?: { code: 'unreadable'; message: string };
}
export interface RuntimeConnectionUpdate {
  revision: string;
  /** null returns to the daemon environment; an empty string disables inheritance. */
  changes: Record<string, string | null>;
}
