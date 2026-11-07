import { Button } from '@pitchcrew/design-system/button';
import { SettingsSection } from '@/SettingsPage/components/SettingsSection.tsx';
import { timeAgo } from '@/lib/time.ts';
import { useDetectorSettings } from '../hooks/useDetectorSettings.ts';
import { DetectorKeyForm } from './DetectorKeyForm.tsx';
import { detectorEntries } from './detector-entries.ts';

/** Bring-your-own-key detector accounts. Keys stay on the daemon host; agents cannot use them. */
export const DetectorSettings = () => {
  const model = useDetectorSettings();
  const configured = model.statuses.filter((status) => status.configured).length;
  return (
    <SettingsSection
      id="detectors-heading"
      title="AI-text detectors"
      scope="This workspace"
      count={`${configured} connected`}
      description="Optional checks of a cover letter or form answers with your own detector account, started only by you from Decisions or job details. Results are advisory and never block approval or export."
    >
      <ul className="settings-list">
        {model.statuses.map((status) => {
          const entry = detectorEntries[status.provider];
          return (
            <li
              key={status.provider}
              id={`detector-${status.provider}`}
              className="settings-list-row"
            >
              <div className="settings-list-main">
                <div className="min-w-0 flex-1 basis-60">
                  <h4>{entry.name}</h4>
                  <span className="quiet">
                    {status.configured && status.savedAt
                      ? `Key saved ${timeAgo(status.savedAt)}. `
                      : 'No key saved. '}
                    {entry.note}{' '}
                    <a href={entry.docsUrl} target="_blank" rel="noreferrer">
                      API documentation
                    </a>
                  </span>
                </div>
                {model.editing !== status.provider ? (
                  <div className="settings-row-actions">
                    <Button
                      id={`detector-${status.provider}-key-trigger`}
                      size="sm"
                      variant="outline"
                      disabled={model.working}
                      onClick={() => model.setEditing(status.provider)}
                    >
                      {status.configured ? 'Replace key' : 'Add key'}
                    </Button>
                    {status.configured ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={model.working}
                        onClick={() => void model.remove(status.provider)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {model.editing === status.provider ? (
                <DetectorKeyForm
                  provider={status.provider}
                  working={model.working}
                  save={(key, email) => model.save(status.provider, key, email)}
                  cancel={model.cancel}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="quiet">
        Keys stay on the computer running Pitchcrew and are never shown to agents.
      </p>
    </SettingsSection>
  );
};
