import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { CrewCardProps } from '@/CrewPage/types.ts';
import { runtimeLabels } from '@/lib/labels.ts';
import { instructionUpdateTitle } from '@/lib/instruction-updates.ts';
import { MessageSquare, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react';

export function CrewCard({
  role,
  status,
  update,
  onConfigure,
  onChat,
  onRestore,
  working,
}: CrewCardProps) {
  return (
    <section className={`crew-card ${role.id}`} data-retired={role.retiredAt ? '' : undefined}>
      <div className="crew-card-top">
        <RoleAvatar agentRole={role.id} />
        <div>
          <h2>{role.name}</h2>
          <span
            className={`role-status ${!role.enabled || status === 'Unavailable' ? 'paused' : ''}`}
          >
            {status}
          </span>
        </div>
      </div>
      <p className="crew-card-description">{role.description}</p>
      {update ? (
        <p className="crew-card-update">
          <Sparkles size={14} aria-hidden="true" />
          {instructionUpdateTitle}
        </p>
      ) : null}
      <dl className="crew-runtime">
        <div>
          <dt>Runtime</dt>
          <dd>{runtimeLabels[role.runtime]}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd title={role.model || undefined}>
            {role.runtime === 'demo' ? 'Scripted' : role.model || 'CLI default'}
          </dd>
        </div>
      </dl>
      <div className="crew-card-actions">
        <Button className="button primary" onClick={onChat}>
          <MessageSquare size={14} aria-hidden="true" /> Chat
        </Button>
        {role.retiredAt ? (
          <Button className="button" onClick={onRestore} disabled={working}>
            <RotateCcw size={14} aria-hidden="true" /> Restore agent
          </Button>
        ) : (
          <Button className="button" onClick={onConfigure}>
            <SlidersHorizontal size={14} aria-hidden="true" /> Configure
          </Button>
        )}
      </div>
      {role.retiredAt ? (
        <p className="quiet crew-card-retired-note">
          Restores paused. Resume in Configure when ready.
        </p>
      ) : null}
    </section>
  );
}
