import { expect, it } from 'vitest';
import { sanitizeEvent } from '../helpers.ts';

it('preserves the reviewed MCP run session over unrelated browser session metadata', () => {
  const session = 'b3aa2328-dbf1-4618-a23b-45c695e9ab10';
  const input = {
    event: '$mcp_tool_call',
    properties: {
      $mcp_tool_name: 'pitchcrew_list_roles',
      $mcp_is_error: false,
      $mcp_duration_ms: 30,
      $mcp_session_id: session,
      $session_id: 'private-existing-session',
      $mcp_parameters: 'private-input',
      $mcp_response: 'private-result',
      $mcp_error_message: 'private-error',
      $current_url: 'https://private.test',
    },
  };
  const output = sanitizeEvent(input)!;
  expect(output.properties.$session_id).toBe(session);
  expect(output.properties.$mcp_session_id).toBe(session);
  expect(JSON.stringify(output)).not.toContain('private');
  expect(sanitizeEvent(input, false)).toBeNull();
});
