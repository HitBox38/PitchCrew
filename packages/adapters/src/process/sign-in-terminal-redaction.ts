import { terminalControlFilter } from './sign-in-terminal-filter.ts';
import { runtimeConnectionSecretNames } from './runtime-connection-fields.ts';

/** Hold partial known secrets across chunks instead of leaking split credentials. */
export const terminalRedactor = (environment: Record<string, string | undefined>) => {
  const secrets = [
    ...new Set(
      Object.entries(environment)
        .filter(
          ([key, value]) =>
            value &&
            (runtimeConnectionSecretNames.has(key) ||
              (/KEY|TOKEN|SECRET|PASSWORD|AUTH/i.test(key) && value.length >= 4)),
        )
        .map(([, value]) => value!),
    ),
  ].sort((a, b) => b.length - a.length);
  const prefixes = secrets.map((secret) => {
    const table = new Array<number>(secret.length).fill(0);
    for (let index = 1, length = 0; index < secret.length; index++) {
      while (length && secret[index] !== secret[length]) length = table[length - 1];
      if (secret[index] === secret[length]) length++;
      table[index] = length;
    }
    return table;
  });
  const states = secrets.map(() => 0);
  const filter = terminalControlFilter();
  let pieces: { raw: string; visible: boolean }[] = [],
    plain = '';
  return (chunk: string, final = false) => {
    let output = '';
    const emit = (count: number) => {
      let index = 0,
        visible = 0;
      while (index < pieces.length && visible < count) {
        const piece = pieces[index++];
        output += piece.raw;
        if (piece.visible) visible++;
      }
      pieces = pieces.slice(index);
      plain = plain.slice(visible);
    };
    filter(chunk, (raw, visible) => {
      if (!visible && !plain) {
        output += raw;
        return;
      }
      pieces.push({ raw, visible });
      if (!visible) return;
      plain += raw;
      let held = 0,
        matched = 0;
      for (let index = 0; index < secrets.length; index++) {
        const secret = secrets[index];
        let state = states[index];
        while (state && secret[state] !== raw) state = prefixes[index][state - 1];
        if (secret[state] === raw) state++;
        states[index] = state;
        if (state === secret.length) matched = Math.max(matched, state);
        held = Math.max(held, state);
      }
      if (matched) {
        emit(plain.length - matched);
        output += '[redacted]';
        pieces = [];
        plain = '';
        states.fill(0);
      } else emit(plain.length - held);
    });
    if (final && plain) {
      output += '[redacted]';
      pieces = [];
      plain = '';
      states.fill(0);
    }
    return output;
  };
};
