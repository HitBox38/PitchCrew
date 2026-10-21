export const smokeMcpCopyRequest = 'pitchcrew-smoke-copy-mcp';

/** Clicks the real Settings copy button; the main process checks the native clipboard. */
export const smokeExternalMcp = `(async () => {
  document.querySelector('a[href^="/settings"]')?.click();
  if (!await waitFor(() => location.pathname === '/settings')) throw new Error('MCP settings navigation failed.');
  [...document.querySelectorAll('[role="tab"]')].find(tab => tab.textContent.includes('Accounts'))?.click();
  const enabled = () => document.querySelector('[role="switch"][aria-labelledby="external-mcp-enabled-label"]');
  if (!await waitFor(() => enabled() && !enabled().disabled)) throw new Error('External MCP settings unavailable.');
  if (enabled().getAttribute('aria-checked') !== 'false') throw new Error('External MCP smoke requires disabled fixture access.');
  enabled().click();
  const copy = () => document.querySelector('button[aria-label="Copy Pitchcrew MCP configuration"]');
  if (!await waitFor(() => !!copy())) throw new Error('MCP configuration copy button missing.');
  const expected = document.querySelector('pre[aria-label="Pitchcrew MCP configuration"]').textContent;
  console.info(${JSON.stringify(smokeMcpCopyRequest)});
  if (!await waitFor(() => copy()?.dataset.copied === 'true')) throw new Error('MCP configuration was not copied by the desktop app.');
  enabled().click();
  if (!await waitFor(() => !copy())) throw new Error('External MCP fixture access was not revoked.');
  return expected;
})()`;
