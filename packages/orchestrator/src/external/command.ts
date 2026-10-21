import {
  disableExternalAccess,
  enableExternalAccess,
  readExternalAccess,
} from '@pitchcrew/mcp/external/access';
import { resolveDaemonSettings } from '../background/settings.ts';
import { externalMcpConfiguration } from './configuration.ts';

export const runMcpCommand = async (args: string[]) => {
  const settings = resolveDaemonSettings(process.env, args);
  let command = 'serve';
  let suppliedCommand = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--home' || arg === '--port') {
      if (!args[++index] || args[index]!.startsWith('--'))
        throw new Error(`${arg} requires a value.`);
    } else if (arg === '--write') continue;
    else if (arg.startsWith('--') || suppliedCommand)
      throw new Error(`Unknown MCP argument: ${arg}`);
    else {
      command = arg;
      suppliedCommand = true;
    }
  }
  if (!['serve', 'enable', 'disable', 'status', 'config'].includes(command))
    throw new Error(
      'Use mcp [serve|enable [--write]|disable|status|config] [--home path] [--port number].',
    );
  if (args.includes('--write') && command !== 'enable')
    throw new Error('--write is only valid with mcp enable.');
  if (command === 'enable') {
    await enableExternalAccess(settings.directory, args.includes('--write'));
    console.error(
      `External MCP enabled (${args.includes('--write') ? 'read and write' : 'read-only'}). Run mcp config for client setup.`,
    );
    return;
  }
  if (command === 'disable') {
    await disableExternalAccess(settings.directory);
    console.error('External MCP access revoked for all connections.');
    return;
  }
  if (command === 'config') {
    console.log(JSON.stringify(externalMcpConfiguration(settings), null, 2));
    return;
  }
  const access = await readExternalAccess(settings.directory);
  if (command === 'status') {
    console.log(JSON.stringify({ enabled: !!access, write: access?.write ?? false }));
    return;
  }
  if (!access) throw new Error('External MCP is disabled. Run the MCP enable command first.');
  const { createExternalClient, serveExternalMcp } = await import('@pitchcrew/mcp/external');
  await serveExternalMcp(
    createExternalClient(`http://127.0.0.1:${settings.port}`, access),
    access.write,
  );
};
