import type { RuntimeConnectionFieldState } from '@pitchcrew/core';

export const connectionSources = {
  saved: 'Saved for this runtime',
  inherited: 'Inherited from the daemon',
  disabled: 'Disabled for this runtime',
  unset: 'Not configured',
};
export const connectionFieldDescription = (field: RuntimeConnectionFieldState) =>
  [connectionSources[field.source], field.description, field.invalidValue?.message]
    .filter((text): text is string => !!text)
    .map((text) => text.replace(/\.+$/, ''))
    .join('. ') + '.';
const shortSources = {
  saved: 'Saved',
  inherited: 'Inherited',
  disabled: 'Disabled',
  unset: 'Not configured',
};
export const connectionOptionLabel = (field: RuntimeConnectionFieldState, pending: boolean) =>
  `${field.label} · ${shortSources[field.source]}${field.invalidValue ? ' · Needs correction' : ''}${pending ? ' · Pending change' : ''}`;
export const connectionChangeLabel = (value: string | null, incomplete = false) =>
  incomplete
    ? 'Incomplete value'
    : value === null
      ? 'Use daemon value'
      : value === ''
        ? 'Disable this variable'
        : 'Replace value';

const validationMessages = new Set([
  'This authentication variable is not supported by the selected runtime.',
  'Authentication values must be a single line of at most 16,384 characters.',
  'Enter a valid HTTP or HTTPS endpoint URL.',
  'Use an HTTP or HTTPS endpoint without credentials, query parameters or a fragment.',
  'Choose one of the supported values shown for this authentication setting.',
  'Use supported authentication variables with bounded, single-line values.',
  'Wait for runtime setup or maintenance to finish.',
  'The workspace is closing.',
]);
/** Only the server's fixed validation copy may appear; never arbitrary credential diagnostics. */
export const connectionValidationMessage = (message: string | undefined) =>
  message?.startsWith('Wait for this runtime to become idle.')
    ? 'Wait for this runtime to become idle. Your draft is kept.'
    : message && validationMessages.has(message)
      ? `${message} Your draft is kept.`
      : undefined;
