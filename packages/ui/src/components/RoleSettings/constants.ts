import { capabilityLabels } from '@/agent-capabilities.ts';

const coordination = new Set(['messageAgents', 'invokeAgents', 'manageWorkflow', 'manageRoutines']);
const services = new Set(['github', 'gmail', 'drive', 'calendar', 'sheets']);
const entries = Object.entries(capabilityLabels);
export const capabilityGroups = [
  { title: 'Crew coordination', entries: entries.filter(([key]) => coordination.has(key)) },
  { title: 'Connected services', entries: entries.filter(([key]) => services.has(key)) },
  { title: 'Computer use', entries: entries.filter(([key]) => key === 'computerUse') },
  {
    title: 'Role tools',
    entries: entries.filter(
      ([key]) => !coordination.has(key) && !services.has(key) && key !== 'computerUse',
    ),
  },
].filter((group) => group.entries.length);
