import { expect, it } from 'vitest';
import { externalConfiguration } from '../configuration.ts';

it('preserves Windows paths, quotes and argument boundaries in JSON and Codex TOML', () => {
  const command = 'C:\\Program Files\\Pitchcrew\\bun.exe';
  const args = [
    'C:\\Code Stuff\\pitchcrew\\cli.ts',
    'mcp',
    '--home',
    'C:\\Users\\Zoë\\"notes"',
    '--port',
    '4417',
  ];
  const configuration = { mcpServers: { pitchcrew: { command, args } } };
  expect(JSON.parse(externalConfiguration(configuration, 'json'))).toEqual(configuration);
  const codex = externalConfiguration(configuration, 'codex');
  expect(codex).toBe(
    '[mcp_servers.pitchcrew]\n' +
      'command = "C:\\\\Program Files\\\\Pitchcrew\\\\bun.exe"\n' +
      'args = ["C:\\\\Code Stuff\\\\pitchcrew\\\\cli.ts","mcp","--home","C:\\\\Users\\\\Zoë\\\\\\"notes\\"","--port","4417"]\n',
  );
  const lines = codex.trim().split('\n');
  expect(JSON.parse(lines[1].slice('command = '.length))).toBe(command);
  expect(JSON.parse(lines[2].slice('args = '.length))).toEqual(args);
});
