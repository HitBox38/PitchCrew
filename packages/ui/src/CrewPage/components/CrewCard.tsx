import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import type { CrewCardProps } from '@/CrewPage/types.ts';
import { runtimeLabels } from '@/lib/labels.ts';
import { MessageSquare, SlidersHorizontal } from 'lucide-react';

export function CrewCard({ role, status, onConfigure, onChat }: CrewCardProps) {
  return (
    <section className={`crew-card ${role.id}`}>
      <div className="crew-card-top">
        <RoleAvatar agentRole={role.id} size="large" />
        <div>
          <h2>{role.name}</h2>
          <span className={`role-status ${!role.enabled ? 'paused' : ''}`}>
            {role.enabled ? 'Enabled' : 'Paused'}
          </span>
        </div>
      </div>
      <p>{role.description}</p>
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
        <div>
          <dt>Now</dt>
          <dd>{status}</dd>
        </div>
      </dl>
      <div className="crew-card-actions">
        <Button className="button primary" onClick={onChat}>
          <MessageSquare size={14} /> Chat
        </Button>
        <Button className="button" onClick={onConfigure}>
          <SlidersHorizontal size={14} /> Configure
        </Button>
      </div>
    </section>
  );
}
