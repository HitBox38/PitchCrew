import { Button } from './components/ui/button.tsx';
import { type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from './components/ui/dialog.tsx';
import { Sheet, SheetContent, SheetTitle } from './components/ui/sheet.tsx';
import { X, Search, PenLine, ShieldCheck, LoaderCircle } from 'lucide-react';
import type { Card, CardState, RoleId, RuntimeId } from '@pitchcrew/core';
import * as m from 'motion/react-m';
import { useMotionValue, useSpring } from 'motion/react';
import { claySpring, useAppReducedMotion } from './motion.tsx';
export const stateLabels: Record<CardState, string> = {
  lead: 'New lead',
  shortlisted: 'Shortlisted',
  drafting: 'Drafting',
  in_review: 'In review',
  changes_requested: 'Changes requested',
  agreed: 'Reviewed',
  awaiting_approval: 'Awaiting approval',
  submitted: 'Submitted',
  screening: 'Screening',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'No response',
};
export const roleIcons = { scout: Search, writer: PenLine, reviewer: ShieldCheck };
export const runtimeLabels: Record<RuntimeId, string> = {
  demo: 'Demo',
  codex: 'Codex',
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  opencode: 'OpenCode',
  'copilot-cli': 'GitHub Copilot CLI',
  'cursor-agent': 'Cursor Agent',
  goose: 'Goose',
  'kiro-cli': 'Kiro CLI',
  grok: 'Grok Build',
  pi: 'Pi',
  'oh-my-pi': 'oh-my-pi',
};
export function RoleAvatar({
  agentRole,
  size = 'normal',
}: {
  agentRole: RoleId;
  size?: 'normal' | 'small' | 'large';
}) {
  const Icon = roleIcons[agentRole];
  return (
    <span className={`role-avatar ${agentRole} ${size}`}>
      <Icon size={size === 'small' ? 13 : size === 'large' ? 25 : 18} aria-hidden="true" />
    </span>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <img src="/favicon.svg" width="26" height="26" alt="" aria-hidden="true" />
      {!compact ? <span>pitchcrew</span> : null}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  if (drawer)
    return (
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent className="modal drawer" showCloseButton={false}>
          <div className="modal-heading">
            <SheetTitle>{title}</SheetTitle>
            <Button
              variant="ghost"
              className="icon-button"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <X size={20} />
            </Button>
          </div>
          {children}
        </SheetContent>
      </Sheet>
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="modal" showCloseButton={false}>
        <div className="modal-heading">
          <DialogTitle>{title}</DialogTitle>
          <Button
            variant="ghost"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </Button>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function CompanyMark({ name }: { name: string }) {
  const colors = ['violet', 'blue', 'pink', 'green', 'orange'];
  let hash = 0;
  for (const c of name) hash += c.charCodeAt(0);
  return (
    <span className={`company-mark ${colors[hash % colors.length]}`} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
export function JobCard({ card, onOpen }: { card: Card; onOpen: () => void }) {
  const reduced = useAppReducedMotion();
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const rotateX = useSpring(tiltX, claySpring);
  const rotateY = useSpring(tiltY, claySpring);
  return (
    <Button
      render={
        <m.button
          layout="position"
          layoutId={`job-${card.id}`}
          initial={reduced ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reduced ? 1 : 0.97 }}
          whileHover={reduced ? undefined : { y: -4 }}
          whileTap={reduced ? undefined : { y: 0, scale: 0.985 }}
          style={{
            rotateX: reduced ? 0 : rotateX,
            rotateY: reduced ? 0 : rotateY,
            transformPerspective: 900,
          }}
          onPointerMove={(event) => {
            if (reduced || event.pointerType !== 'mouse') return;
            const rect = event.currentTarget.getBoundingClientRect();
            tiltX.set((0.5 - (event.clientY - rect.top) / rect.height) * 4);
            tiltY.set(((event.clientX - rect.left) / rect.width - 0.5) * 4);
          }}
          onPointerLeave={() => {
            tiltX.set(0);
            tiltY.set(0);
          }}
        />
      }
      className="job-card"
      onClick={onOpen}
      aria-label={`Open ${card.title} at ${card.company}`}
    >
      <div className="job-top">
        <CompanyMark name={card.company} />
        <strong>{card.company}</strong>
        {card.sample ? <span className="sample-tag">example</span> : null}
      </div>
      <h3>{card.title}</h3>
      <p className="job-location">
        {card.location || 'Location not given'}
        {card.salary ? <span> · {card.salary}</span> : null}
      </p>
      {card.tags.length ? (
        <div className="tags">
          {card.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      <div className="job-bottom">
        {card.fit !== null ? (
          <span className={`fit ${card.fit >= 80 ? 'high' : ''}`}>
            <span className="fit-meter" aria-hidden="true">
              <span style={{ width: `${card.fit}%` }} />
            </span>
            {card.fit}% fit
          </span>
        ) : (
          <span className="subtle">Not scored</span>
        )}
        {card.owner ? (
          <span className="owner">
            <LoaderCircle size={13} className="spin" />
            <RoleAvatar agentRole={card.owner} size="small" />
          </span>
        ) : (
          <span className={`state-pill ${card.state}`}>{stateLabels[card.state]}</span>
        )}
      </div>
    </Button>
  );
}
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function timeAgo(date: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  return mins < 1
    ? 'Just now'
    : mins < 60
      ? `${mins}m ago`
      : mins < 1440
        ? `${Math.floor(mins / 60)}h ago`
        : new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
