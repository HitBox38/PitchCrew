import type { BackgroundServiceInfo } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Download, LoaderCircle } from 'lucide-react';
import { serviceBadges, serviceCommands, serviceNotes } from '../helpers.ts';
import { ServiceCommand } from './ServiceCommand.tsx';

export const ServiceState = ({
  info,
  installing,
  disabled,
  install,
}: {
  info: BackgroundServiceInfo;
  installing: boolean;
  disabled: boolean;
  install: () => Promise<void>;
}) => {
  const commands = serviceCommands(info);
  const canInstall = !!info.status.platform && (!info.status.installed || !info.matches);
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
      {info.status.platform ? (
        <output className="info-note mb-0 block">{info.status.detail}</output>
      ) : null}
      {canInstall ? (
        <div className="mt-4">
          <Button className="button primary" disabled={disabled} onClick={install}>
            {installing ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            {installing
              ? 'Installing…'
              : info.status.installed
                ? 'Use for this workspace'
                : 'Install background service'}
          </Button>
          <output className="info-note block">
            {installing
              ? 'Preparing the production UI and installing the service. This may take a few minutes.'
              : 'Pitchcrew builds the production UI if needed and installs the service automatically. No administrator rights are needed.'}
          </output>
        </div>
      ) : null}
      {commands.map((command) => (
        <ServiceCommand command={command} key={command} />
      ))}
      {commands.length ? (
        <p className="info-note">
          Run these commands in <code className="wrap-anywhere">{info.repository}</code>. The
          service never needs administrator rights.
        </p>
      ) : null}
    </>
  );
};
