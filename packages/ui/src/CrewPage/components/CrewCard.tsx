import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { capabilityLine, runtimeLine } from '@/CrewPage/helpers.ts';
import type { CapabilityLine, CrewCardProps } from '@/CrewPage/types.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import {
  FileText,
  Globe,
  Layers,
  Mail,
  MessageSquare,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { CrewCardMenu } from './CrewCardMenu.tsx';
import { CrewStatusTray } from './CrewStatusTray.tsx';
import { CrewTimeline } from './CrewTimeline.tsx';

const icons: Record<CapabilityLine['icon'], typeof Globe> = {
  browser: Globe,
  draft: PenLine,
  review: ShieldCheck,
  fit: Search,
  mail: Mail,
  crew: Layers,
  notes: FileText,
  chat: MessageSquare,
};

/** One agent: identity, setup, today's work and what it is doing now. */
export const CrewCard = (props: CrewCardProps) => {
  const { role, status, update, now, onConfigure, onChat, onReview } = props;
  const data = useWorkspaceStore((state) => state.data);
  const capability = capabilityLine(role);
  const Icon = icons[capability.icon];
  return (
    <article
      className={`crew-card ${role.id}`}
      data-status={status.kind}
      aria-labelledby={`crew-${role.id}-name`}
    >
      <div className="crew-card-head">
        <span className="crew-pebble" data-live={status.kind === 'working' ? '' : undefined}>
          <RoleAvatar agentRole={role.id} size="large" />
        </span>
        <span className="crew-card-actions">
          {update ? (
            <Button className="ui-chip crew-card-update" data-tone="plum" onClick={onReview}>
              <Sparkles size={12} aria-hidden="true" />
              Update
              <span className="sr-only"> to {role.name}’s default instructions</span>
            </Button>
          ) : null}
          <Button className="text-button crew-card-chat" onClick={onChat}>
            Chat
          </Button>
          <CrewCardMenu {...props} />
        </span>
      </div>
      <h2 id={`crew-${role.id}-name`} className="crew-card-name">
        <Button className="crew-card-name-button" onClick={onConfigure}>
          {role.name}
        </Button>
      </h2>
      <p className="crew-card-model">{data ? runtimeLine(role, data) : null}</p>
      <p className="crew-card-capability">
        <Icon size={14} aria-hidden="true" />
        {capability.label}
      </p>
      <CrewTimeline roleId={role.id} name={role.name} now={now} />
      <CrewStatusTray status={status} name={role.name} />
    </article>
  );
};
