/** Applies to agent evidence, including a password revealed as a normal text input. */
export const credentialSelector =
  'input[type="password"],input[autocomplete="current-password"],input[autocomplete="new-password"],input[autocomplete="one-time-code"],input[name*="password" i],input[id*="password" i],input[name*="passwd" i],input[id*="passwd" i],input[name*="passphrase" i],input[id*="passphrase" i]';
export function redactCredentials(text: string, values: readonly string[]) {
  return values
    .filter(Boolean)
    .reduce((result, value) => result.split(value).join('[hidden]'), text);
}
