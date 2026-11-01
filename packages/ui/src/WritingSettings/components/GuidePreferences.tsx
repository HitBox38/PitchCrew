import type { WritingGuide, WritingPreference } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { writingScopes } from '@/lib/application-quality.ts';
import { CorrectionEvidence } from './CorrectionEvidence.tsx';

export const GuidePreferences = ({
  guide,
  change,
  working,
  edit,
}: {
  guide: WritingGuide;
  change: (data: Record<string, unknown>) => Promise<unknown>;
  working: boolean;
  edit: (item: WritingPreference) => void;
}) => {
  const state = (id: string, operation: string) =>
    void change({ action: 'preference_state', id, operation }).catch(() => {});
  if (!guide.preferences.length)
    return (
      <p className="ui-empty">
        No preferences yet. Add one such as “Use short sentences”, or ask Writer to correct a draft
        in chat.
      </p>
    );
  return (
    <ul className="settings-list" aria-label="Writing preferences">
      {guide.preferences.map((item) => (
        <li key={item.id} className="settings-list-row" data-disabled={!item.enabled || undefined}>
          <div className="settings-list-main">
            <div className="min-w-0 flex-1 basis-64">
              <p className="settings-preference wrap-anywhere">{item.text}</p>
              <p className="ui-row-meta">
                {writingScopes[item.scope]} ·{' '}
                {item.origin === 'explicit' ? 'Your preference' : 'Learned from your corrections'}
                {!item.enabled ? ' · Disabled' : ''}
              </p>
            </div>
            <div className="settings-row-actions">
              <Button size="sm" variant="ghost" disabled={working} onClick={() => edit(item)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={working}
                onClick={() => state(item.id, item.enabled ? 'disable' : 'enable')}
              >
                {item.enabled ? 'Disable' : 'Enable'}
              </Button>
              {item.origin === 'learned' ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={working}
                  onClick={() => state(item.id, 'undo')}
                >
                  Undo learning
                </Button>
              ) : null}
            </div>
          </div>
          {item.correctionIds.map((id) => (
            <CorrectionEvidence id={id} key={id} />
          ))}
        </li>
      ))}
    </ul>
  );
};
