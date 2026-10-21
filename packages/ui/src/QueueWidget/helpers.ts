export const queueActivityDescription = (agents: number, running: number) => {
  if (!agents) return 'Independent jobs and conversations work in parallel.';
  return `${agents} agent ${agents === 1 ? 'run' : 'runs'} across ${running} active ${running === 1 ? 'queue' : 'queues'}.`;
};
