import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { routineInput } from '@pitchcrew/core';
import { z } from 'zod';
import type { AgentCall } from './client.ts';
import { readOnly } from './constants.ts';

export function registerRoutineTools(server: McpServer, call: AgentCall) {
  server.registerTool(
    'pitchcrew_list_routines',
    {
      title: 'List routines and scheduled actions',
      description:
        'Read accessible schedules, IDs, next occurrence, run counts, and current time/timezone. Use before editing or deleting; do not invent IDs.',
      inputSchema: {},
      annotations: readOnly,
    },
    () => call('routines'),
  );
  server.registerTool(
    'pitchcrew_save_routine',
    {
      title: 'Create or edit a routine',
      description:
        'Persist an action for yourself or another role. Omit routineId to create; supply it to replace an existing routine. startAt and endsAt are ISO timestamps with offsets; timezone is IANA. With neither cron nor intervalMinutes it runs once. Use intervalMinutes for elapsed intervals or a five-field cron for timezone-aware calendar repeats, e.g. 0 9 * * 1-5. Limit with maxRuns (total dispatches) and/or endsAt; enabled=false pauses. Runs only while the daemon is open, coalesces overdue repeats, waits for busy/paused roles. Each occurrence starts an isolated chat turn and retains every outward-action approval gate. Ask about ambiguous times. Never claim a schedule exists until this tool succeeds.',
      inputSchema: { routineId: z.uuid().optional(), input: routineInput },
      annotations: { ...readOnly, readOnlyHint: false, idempotentHint: false },
    },
    (input) => call('save_routine', input),
  );
  server.registerTool(
    'pitchcrew_delete_routine',
    {
      title: 'Delete a routine',
      description:
        'Stop future occurrences of an accessible routine. Retains history and does not cancel an already running turn.',
      inputSchema: { routineId: z.uuid() },
      annotations: { ...readOnly, readOnlyHint: false },
    },
    (input) => call('delete_routine', input),
  );
}
