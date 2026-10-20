import type { AppUpdateInfo } from '@pitchcrew/core';

export const UpdateTooltip = ({
  release,
  version,
  message,
  ready,
}: {
  release: AppUpdateInfo['latest'] | undefined;
  version: string | null | undefined;
  message: string | undefined;
  ready: boolean;
}) => {
  const changes = release?.changes?.slice(0, 5) ?? [];
  return (
    <div className="flex flex-col gap-2 text-left text-pretty">
      <p className="font-semibold">
        {version ? `Version ${version}` : `Build ${release?.commit.slice(0, 12) ?? 'available'}`}
      </p>
      {changes.length ? (
        <>
          <p>What changed</p>
          <ul className="list-disc space-y-1 pl-4">
            {changes.map((change, index) => (
              <li key={index}>{change}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>Release notes unavailable.</p>
      )}
      {release?.moreChanges ? <p>More changes in release notes.</p> : null}
      {message ? <p className="border-t border-current/20 pt-2">{message}</p> : null}
      {ready ? <p>Restarting interrupts running agents. Your work stays saved.</p> : null}
    </div>
  );
};
