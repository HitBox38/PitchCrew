/** Quoting for each service definition format, plus the parsers status uses to read them back. */

export function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function unescapeXml(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|quot|apos|amp);/gi, (_match, entity: string) => {
    const named: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' };
    if (entity[0] !== '#') return named[entity.toLowerCase()];
    const code =
      entity[1] === 'x' || entity[1] === 'X'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

/** Quotes one argument for the command line parsed by Windows programs (CommandLineToArgvW). */
export function quoteWindowsArgument(value: string) {
  if (value && !/[\s"]/.test(value)) return value;
  let quoted = '"';
  let backslashes = 0;
  for (const char of value) {
    if (char === '\\') {
      backslashes++;
      continue;
    }
    quoted += '\\'.repeat(char === '"' ? backslashes * 2 + 1 : backslashes) + char;
    backslashes = 0;
  }
  return `${quoted}${'\\'.repeat(backslashes * 2)}"`;
}

/** Splits a Windows command line the way CommandLineToArgvW does. */
export function parseWindowsArguments(line: string) {
  const args: string[] = [];
  let index = 0;
  while (index < line.length) {
    while (line[index] === ' ' || line[index] === '\t') index++;
    if (index >= line.length) break;
    let arg = '';
    let quoted = false;
    while (index < line.length && (quoted || (line[index] !== ' ' && line[index] !== '\t'))) {
      const char = line[index];
      if (char === '\\') {
        let count = 0;
        while (line[index] === '\\') {
          count++;
          index++;
        }
        if (line[index] === '"') {
          arg += '\\'.repeat(Math.floor(count / 2));
          if (count % 2) {
            arg += '"';
            index++;
          }
        } else arg += '\\'.repeat(count);
      } else if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          arg += '"';
          index += 2;
        } else {
          quoted = !quoted;
          index++;
        }
      } else {
        arg += char;
        index++;
      }
    }
    args.push(arg);
  }
  return args;
}

function assertSingleLine(value: string) {
  if (/[\0\r\n]/.test(value))
    throw new Error('Service paths and values cannot contain line breaks.');
  return value;
}

/** Quotes an ExecStart= argument: systemd expands %-specifiers and $VARIABLES there. */
export function quoteSystemdArgument(value: string) {
  return `"${assertSingleLine(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/%/g, '%%')
    .replace(/\$/g, '$$$$')}"`;
}

/** Quotes an Environment= assignment: systemd expands %-specifiers but not variables there. */
export function quoteSystemdEnvironment(name: string, value: string) {
  return `"${name}=${assertSingleLine(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/%/g, '%%')}"`;
}

/** Escapes a path setting such as WorkingDirectory=, which is one unquoted value. */
export function escapeSystemdPath(value: string) {
  return assertSingleLine(value).replace(/%/g, '%%');
}

/** Splits an ExecStart= line written by quoteSystemdArgument or plain unquoted words. */
export function parseSystemdArguments(line: string) {
  const args: string[] = [];
  let index = 0;
  while (index < line.length) {
    while (/\s/.test(line[index] ?? '')) index++;
    if (index >= line.length) break;
    let arg = '';
    let quote: string | null = null;
    while (index < line.length && (quote || !/\s/.test(line[index]))) {
      const char = line[index];
      if (char === '\\' && index + 1 < line.length) {
        arg += line[index + 1];
        index += 2;
      } else if (quote && char === quote) {
        quote = null;
        index++;
      } else if (!quote && (char === '"' || char === "'")) {
        quote = char;
        index++;
      } else {
        arg += char;
        index++;
      }
    }
    args.push(arg.replace(/%%/g, '%').replace(/\$\$/g, '$'));
  }
  return args;
}
