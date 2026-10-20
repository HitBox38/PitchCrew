import type { ChatViewModel } from '@/ChatView/types.ts';
import { Link } from '@tanstack/react-router';

export function RuntimeReadinessNotice({ data, role, conversation }: ChatViewModel) {
  const config = { ...role, ...conversation?.configurations[role.id] };
  const maintenance = data.runtimeMaintenance;
  const update = maintenance?.updates.find((entry) => entry.id === config.runtime);
  const auth = maintenance?.authentication.find(
    (entry) => entry.runtime === config.runtime && entry.model === config.model,
  )?.result;
  const updating = !!update?.operation && !update.operation.finishedAt;
  if (!updating && (!auth || auth.status === 'authenticated')) return null;
  return (
    <output className="mx-4 my-2 rounded-lg border px-3 py-2 text-sm">
      <p>
        {updating
          ? 'This runtime is updating. Queued work will wait for verification.'
          : auth?.detail}
      </p>
      <Link
        className="underline"
        to="/settings"
        search={{ section: 'runtimes', runtime: config.runtime }}
        hash={`runtime-${config.runtime}`}
      >
        Open runtime settings
      </Link>
    </output>
  );
}
