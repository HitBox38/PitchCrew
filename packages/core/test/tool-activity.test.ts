import { describe, expect, it } from 'vitest';
import {
  activityLimits,
  activityLine,
  clipText,
  crewActionForTool,
  crewToolLabelsFor,
  isActivityToolKind,
  nativeFailureReason,
  nativeToolLabels,
  preGatewayFailure,
  redactCredentials,
  redactValues,
  toolLabel,
  unknownCrewToolLabels,
} from '../src/tool-activity.ts';

// Credential-shaped fixtures are assembled at runtime so no token-like literal sits in the source.
const fake = (prefix: string, length: number) => prefix + 'Fx0'.repeat(length).slice(0, length);

describe('activity text', () => {
  it('keeps one printable, bounded line', () => {
    expect(activityLine('\u001b[31mError\u001b[0m:\n\tfile\u0000missing  ', 300)).toBe(
      'Error: file missing',
    );
    const long = activityLine('x'.repeat(500), 200)!;
    expect(long).toHaveLength(200);
    expect(long.endsWith('…')).toBe(true);
    expect(activityLine(' \n\t ', 200)).toBeUndefined();
    expect(activityLine(42, 200)).toBeUndefined();
  });

  it('drops bidirectional overrides so a name cannot display reordered', () => {
    expect(activityLine('invoice\u202Efdp.exe', 200)).toBe('invoicefdp.exe');
    expect(activityLine('a\u2066b\u2069c', 200)).toBe('abc');
  });

  it('stays fast on long unbroken text, still redacting what it shows', () => {
    // Long unbroken runs once made credential shapes rescan from every word: seconds each.
    for (const unit of ['x-', 'eyJ-', 'a.', 'senior-software-engineer-']) {
      const text = unit.repeat(Math.ceil((256 * 1024) / unit.length));
      const started = performance.now();
      const line = activityLine(text, activityLimits.error)!;
      expect(performance.now() - started).toBeLessThan(250);
      // The redaction window cut this one word, so none of it is shown.
      expect(line).toBe('…');
    }
    // A credential in view is redacted however long the text, and a private key cut off by the
    // redaction window still is to its end.
    const token = fake('sk-', 24);
    expect(activityLine(`key ${token} ${'x-'.repeat(128 * 1024)}`, 200)).toBe('key [redacted] …');
    // A key that shrinks to a few words pulls text from the window's edge into view: a credential
    // the window cut never shows even its start.
    // 4,795 characters: the token starts five characters before the 4,800-character window ends.
    const pem = `-----BEGIN RSA PRIVATE KEY----- ${'QUJD'.repeat(1183)} -----END RSA PRIVATE KEY----- `;
    expect(activityLine(`${pem}${fake('sk-', 40)}`, activityLimits.error)).toBe(
      '[redacted private key] …',
    );
    // Credentials after a long glued run still match: the window bounds the scheme's cost.
    expect(
      activityLine(`${'a'.repeat(40)}https://user:${fake('pw', 12)}@host.example.test/x`, 300),
    ).toBe(`${'a'.repeat(40)}https://[redacted]@host.example.test/x`);
    const key = `Error: -----BEGIN RSA PRIVATE KEY----- ${'QUJD'.repeat(4096)}`;
    expect(activityLine(key, activityLimits.error)).toBe('Error: [redacted private key]');
  });

  it('shortens without splitting a surrogate pair or exceeding the bound', () => {
    expect(clipText('abcd🚀ef', 6)).toBe('abcd…');
    expect(clipText('abc defgh', 5)).toBe('abc…');
    expect(clipText('short', 10)).toBe('short');
    expect(clipText('abcdef', 1)).toBe('…');
    expect(clipText('abcdef', 0).length).toBeLessThanOrEqual(1);
  });
});

describe('credential redaction', () => {
  it.each([
    ['curl -H "Authorization: Bearer abc123def456ghi789"', 'abc123def456ghi789'],
    ['Authorization: Basic dXNlcjpwYXNz', 'dXNlcjpwYXNz'],
    [`key ${fake('sk-', 24)} rejected`, fake('sk-', 24)],
    [`push with ${fake('ghp_', 36)}`, fake('ghp_', 36)],
    [`grok ${fake('xai-', 40)}`, fake('xai-', 40)],
    [`aws AKIA${'FIXTURE0'.repeat(2)} denied`, 'FIXTURE0FIXTURE0'],
    [`jwt ${['eyJfixture00', 'fixture001', 'fixture002'].join('.')}`, 'fixture002'],
    ['https://example.com/callback?code=fixture123&state=ok', 'fixture123'],
    ['git clone https://fixture:hunter22@example.com/repo.git', 'hunter22'],
    ['tool --api-key fixture-key-123 --verbose', 'fixture-key-123'],
    ['OPENAI_API_KEY=fixture-value npm test', 'fixture-value'],
    ['{"password": "hunter22", "user": "fixture"}', 'hunter22'],
    ['{"client_secret": "fixture-client", "refresh_token": "fixture-refresh"}', 'fixture-'],
    ['-----BEGIN RSA PRIVATE KEY-----\nMIIEfixture\n-----END RSA PRIVATE KEY-----', 'MIIE'],
  ])('removes the credential in %j', (text, secret) => {
    const redacted = redactCredentials(text);
    expect(redacted).not.toContain(secret);
    expect(redacted).toContain('[redacted');
  });

  it('keeps paths, hosts, commands and ordinary words readable', () => {
    for (const text of [
      '/Users/fixture/project/src/index.ts',
      'https://example.com/jobs/1',
      'grep -rn token src',
      'Basic authentication required',
      'Token validation failed for this request',
      'Invalid bearer token provided',
      'max_tokens: 1000',
    ])
      expect(redactCredentials(text)).toBe(text);
  });

  it('removes exact secret values longest first, and each line of a multi-line secret', () => {
    expect(redactValues('token fixture-secret-1 and fixture-secret-1', ['fixture-secret-1'])).toBe(
      'token [redacted] and [redacted]',
    );
    expect(redactValues('value abcdefgh', ['abcd', 'abcdefgh'])).toBe('value [redacted]');
    expect(redactValues('abc stays', ['abc', undefined, ''])).toBe('abc stays');
    const key =
      '-----BEGIN FIXTURE KEY-----\n  QUJDREVGR0hJSktMTU5PUFFS\n-----END FIXTURE KEY-----';
    expect(redactValues('last line QUJDREVGR0hJSktMTU5PUFFS', [key])).toBe('last line [redacted]');
    expect(redactValues(`whole ${key}`, [key])).toBe('whole [redacted]');
  });
});

describe('native tool failures', () => {
  it.each([
    [
      'MCP error -32602: Input validation error: Invalid arguments for tool pitchcrew_get_card: Invalid input: expected string, received number at cardId',
      true,
    ],
    ['MCP error -32602: Tool pitchcrew_missing not found', true],
    ['Error: MCP error -32001: Request timed out', true],
    [
      '<tool_use_error>InputValidationError: mcp__pitchcrew__pitchcrew_get_card failed</tool_use_error>',
      true,
    ],
    [
      '<tool_use_error>Error: No such tool available: mcp__pitchcrew__pitchcrew_gone</tool_use_error>',
      true,
    ],
    ["Tool 'pitchcrew_gone' not found", true],
    ['This role cannot export packets.', false],
    ['Card not found.', false],
    ['Approval required before MCP error -32602: later text', false],
    ['', false],
  ])('treats %j as a failure before the gateway: %s', (text, expected) => {
    expect(preGatewayFailure(text)).toBe(expected);
  });

  it.each([
    ['MCP error -32602: Input validation error: Invalid arguments for tool x', 'invalid_input'],
    ['Arguments do not match the tool schema', 'invalid_input'],
    ['MCP error -32001: Request timed out', 'timeout'],
    ['tool call timed out after 60s', 'timeout'],
    ['Permission to use WebFetch has been denied.', 'not_allowed'],
    ['MCP error -32602: Tool pitchcrew_missing not found', 'not_found'],
    ["Model tried to call unavailable tool 'fixture'", 'not_found'],
    ['ENOENT: no such file or directory, open /fixture/schema.json', 'not_found'],
    ['connect ECONNREFUSED 127.0.0.1:4417', 'unavailable'],
    ['MCP error -32000: Connection closed', 'unavailable'],
    ['The operation was aborted', 'cancelled'],
    ['Exit code 2: make: *** [all] Error 2', 'tool_error'],
    ['', 'tool_error'],
  ])('classifies %j as %s', (text, reason) => {
    expect(nativeFailureReason(text)).toBe(reason);
  });
});

describe('tool step words', () => {
  it('picks the tense for a status and knows only its own kinds', () => {
    const labels = nativeToolLabels.command;
    expect(toolLabel(labels, 'running')).toBe('Running command');
    expect(toolLabel(labels, 'interrupted')).toBe('Running command');
    expect(toolLabel(labels, 'completed')).toBe('Ran command');
    expect(toolLabel(labels, 'failed')).toBe('Command failed');
    expect(isActivityToolKind('web_search')).toBe(true);
    expect(isActivityToolKind('shell')).toBe(false);
    expect(isActivityToolKind(1)).toBe(false);
  });

  it('maps reviewed MCP names to gateway actions and never trusts inherited keys', () => {
    expect(crewActionForTool('pitchcrew_get_card')).toBe('card');
    expect(crewActionForTool('gmail_search_messages')).toBe('connector');
    expect(crewActionForTool('pitchcrew_unpublished')).toBeUndefined();
    expect(crewToolLabelsFor('constructor')).toBe(unknownCrewToolLabels);
    expect(crewToolLabelsFor('')).toBe(unknownCrewToolLabels);
  });
});
