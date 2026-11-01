import type { BackgroundServiceInfo } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Download, LoaderCircle } from 'lucide-react';
import { serviceBadges, serviceNotes, serviceRunning } from '../helpers.ts';
import { ServiceCommands } from './ServiceCommands.tsx';

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
  const canInstall = !!info.status.platform && (!info.status.installed || !info.matches);
  const running = serviceRunning(info);
  return (
    <div className="settings-list">
      <div className="settings-list-row">
        <div className="settings-list-main">
          <span
            className="clay-bead"
            data-size="sm"
            data-tone={running ? 'moss' : undefined}
            data-empty={running ? undefined : ''}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1 basis-64">
            <div className="settings-list-title">
              {serviceBadges(info).map((badge, index) => (
                <span className={index ? 'ui-chip' : 'settings-status-label'} key={badge.label}>
                  {badge.label}
                </span>
              ))}
            </div>
            {serviceNotes(info).map((note) => (
              <p className="quiet" key={note}>
                {note}
              </p>
            ))}
            {info.status.platform ? (
              <output className="quiet block">{info.status.detail}</output>
            ) : null}
          </div>
          {canInstall ? (
            <Button variant="outline" size="sm" disabled={disabled} onClick={install}>
              {installing ? (
                <LoaderCircle size={14} className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Download size={14} />
              )}
              {installing
                ? 'Installing…'
                : info.status.installed
                  ? 'Use for this workspace'
                  : 'Install background service'}
            </Button>
          ) : null}
        </div>
        {canInstall ? (
          <output className="quiet block">
            {installing
              ? 'Preparing the production UI and installing the service. This may take a few minutes.'
              : 'Pitchcrew builds the production UI if needed and installs the service. No administrator rights are needed.'}
          </output>
        ) : null}
      </div>
      <ServiceCommands info={info} />
    </div>
  );
};
