import { Check } from 'lucide-react';
import { ActivityGroup } from '@/ChatTurn/components/ActivityGroup.tsx';
import { TurnDuration } from '@/ChatTurn/components/TurnDuration.tsx';
import { activityGroups } from '@/ChatTurn/helpers.ts';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { turn } from '../constants';

// Mirrors the app's ChatTurn markup; commentary is plain text, so it skips the Markdown renderer.
export const DemoTurn = () => {
  return (
    <section className="chat-turn" aria-label="Writer turn activity">
      <div className="chat-turn-heading flex items-center gap-2 text-detail text-muted-foreground">
        <RoleAvatar agentRole="writer" size="small" />
        <strong className="shrink-0 text-foreground">Writer</strong>
        <Check size={13} className="shrink-0" aria-hidden="true" />
        <output className="min-w-0 truncate">Completed</output>
        <TurnDuration startedAt={turn.startedAt} finishedAt={turn.finishedAt} active={false} />
      </div>
      <div className="chat-turn-body ml-7.5 flex flex-col gap-3">
        {activityGroups(turn.activity).map((group, index) =>
          group.kind === 'work' ? (
            <ActivityGroup key={group.id} entries={group.entries} defaultOpen={index === 1} />
          ) : (
            <div key={group.id} className="chat-turn-commentary">
              <p>{group.entries[0].text}</p>
            </div>
          ),
        )}
      </div>
    </section>
  );
};
