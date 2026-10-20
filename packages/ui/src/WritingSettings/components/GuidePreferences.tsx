import type { WritingGuide, WritingPreference } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { writingScopes } from '@/lib/application-quality.ts';
import { CorrectionEvidence } from './CorrectionEvidence.tsx';

export function GuidePreferences({
  guide,
  change,
  working,
  edit,
}: {
  guide: WritingGuide;
  change: (data: Record<string, unknown>) => Promise<unknown>;
  working: boolean;
  edit: (item: WritingPreference) => void;
}) {
  return (
    <div className="space-y-4">
      {!guide.preferences.length ? (
        <p className="quiet">
          Add a preference, or ask Writer to correct an attached draft in chat. Repeated corrections
          can teach the guide.
        </p>
      ) : null}
      {guide.preferences.map((item) => (
        <article key={item.id} className="space-y-2 border-b border-border pb-4">
          <p className="font-semibold">{item.text}</p>
          <p className="quiet">
            {writingScopes[item.scope]} ·{' '}
            {item.origin === 'explicit' ? 'Explicit preference' : 'Learned from your corrections'}
            {!item.enabled ? ' · Disabled' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={working} onClick={() => edit(item)}>
              Edit
            </Button>
            <Button
              disabled={working}
              onClick={() =>
                void change({
                  action: 'preference_state',
                  id: item.id,
                  operation: item.enabled ? 'disable' : 'enable',
                }).catch(() => {})
              }
            >
              {item.enabled ? 'Disable' : 'Enable'}
            </Button>
            {item.origin === 'learned' ? (
              <Button
                disabled={working}
                onClick={() =>
                  void change({ action: 'preference_state', id: item.id, operation: 'undo' }).catch(
                    () => {},
                  )
                }
              >
                Undo learning
              </Button>
            ) : null}
          </div>
          {item.correctionIds.map((id) => (
            <CorrectionEvidence id={id} key={id} />
          ))}
        </article>
      ))}
    </div>
  );
}
