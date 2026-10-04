import type { BackgroundServiceInfo } from '@pitchcrew/core';
import { serviceBadges, serviceCommands, serviceNotes } from '../helpers.ts';
import { ServiceCommand } from './ServiceCommand.tsx';

export function ServiceState({ info }: { info: BackgroundServiceInfo }) {
  const commands = serviceCommands(info);
  return (
    <>
      <div
        className="mt-4 flex flex-wrap items-center gap-2"
        aria-label="Background service status"
      >
        {serviceBadges(info).map((badge) => (
          <span className={`badge ${badge.success ? 'success' : ''}`} key={badge.label}>
            {badge.label}
          </span>
        ))}
      </div>
      {serviceNotes(info).map((note) => (
        <p className="info-note mb-0" key={note}>
          {note}
        </p>
      ))}
      {commands.map((command) => (
        <ServiceCommand command={command} key={command} />
      ))}
      {commands.length ? (
        <p className="info-note">
          Run these commands in <code className="wrap-anywhere">{info.repository}</code>. The
          service runs the built UI, so run pnpm build first. It never needs administrator rights.
        </p>
      ) : null}
    </>
  );
}
