import { expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mcpGatewayTools, mcpConnectorTools } from '@pitchcrew/core';
import { connectorTools } from '../src/connectors/tools.ts';
import { registerQualityTools } from '../src/tools/quality.ts';
import { registerDiagnosticTools } from '../src/tools/diagnostics.ts';
import { registerCrewTools } from '../src/tools/crew.ts';
import { registerPacketTools } from '../src/tools/packet.ts';
import { registerComputerTools } from '../src/tools/computer.ts';
import { registerTrackingTools } from '../src/tools/tracking.ts';
import { registerPipelineTools } from '../src/tools/pipeline.ts';
import { registerProfileTools } from '../src/tools/profile.ts';
import { registerJobSourceTools } from '../src/tools/job-sources.ts';
import { registerDeepReviewTools } from '../src/tools/deep-reviews.ts';
import { registerRoutineTools } from '../src/tools/routines.ts';
import { registerLinkedInTools } from '../src/tools/linkedin.ts';

it('keeps reviewed telemetry names aligned with all advertised production tools', async () => {
  const server = new McpServer({ name: 'fixture', version: '1.0.0' });
  const register = vi.spyOn(server, 'registerTool');
  const call = vi.fn().mockResolvedValue({
    content: [],
    structuredContent: {
      enabled: true,
      assessForms: true,
      recordSubmissions: true,
      reviewPipeline: true,
      proposeCrewChanges: true,
      discoverJobs: true,
      readApplications: true,
      trackApplications: true,
    },
  });
  registerCrewTools(server, call);
  registerDiagnosticTools(server, call);
  registerQualityTools(server, call);
  registerLinkedInTools(server, call);
  registerPacketTools(server, call);
  await registerComputerTools(server, call);
  await registerTrackingTools(server, call);
  await registerPipelineTools(server, call);
  registerProfileTools(server, call);
  await registerJobSourceTools(server, call);
  registerRoutineTools(server, call);
  registerDeepReviewTools(server, call);
  registerDeepReviewTools(server, call, 'parent');
  registerDeepReviewTools(server, call, 'subagent');
  const actual = (register.mock.calls as unknown as [string][]).map(([name]) => name);
  expect(actual.filter((name) => name !== 'pitchcrew_list_connectors').sort()).toEqual(
    Object.values(mcpGatewayTools).sort(),
  );
  expect([...mcpConnectorTools].sort()).toEqual(Object.keys(connectorTools).sort());
});
