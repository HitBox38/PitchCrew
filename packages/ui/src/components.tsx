import { Button } from './components/ui/button.tsx';
import { type ReactNode } from 'react';
import { Dialog, DialogContent, DialogTitle } from './components/ui/dialog.tsx';
import { Sheet, SheetContent, SheetTitle } from './components/ui/sheet.tsx';
import { X, Search, PenLine, ShieldCheck, LoaderCircle, Monitor, Sun, Moon } from 'lucide-react';
import type { ThemeChoice } from './theme.ts';
import type { Card, CardState, RoleId } from '@pitchcrew/core';
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
export const runtimeLabels = { demo: 'Demo', codex: 'Codex', 'claude-code': 'Claude Code' };
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
      <svg viewBox="0 0 40 40" width="26" height="26" aria-hidden="true">
        <rect width="40" height="40" rx="11" fill="currentColor" />
        <path d="M12 29V12h9a8 8 0 0 1 0 16h-3v-6h3a2 2 0 0 0 0-4h-3v11z" fill="white" />
      </svg>
      {!compact ? <span>pitchcrew</span> : null}
    </div>
  );
}
const themeOptions = [
  { id: 'system', label: 'Match system', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
] as const;
export function ThemeSwitch({
  value,
  onChange,
}: {
  value: ThemeChoice;
  onChange: (value: ThemeChoice) => void;
}) {
  return (
    <fieldset className="theme-switch">
      <legend className="sr-only">Colour theme</legend>
      {themeOptions.map((option) => (
        <Button
          key={option.id}
          className={value === option.id ? 'active' : ''}
          aria-pressed={value === option.id}
          aria-label={option.label}
          title={option.label}
          onClick={() => onChange(option.id)}
        >
          <option.icon size={14} />
        </Button>
      ))}
    </fieldset>
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
        <SheetContent className="modal drawer" showCloseButton={false} aria-describedby={undefined}>
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
      <DialogContent className="modal" showCloseButton={false} aria-describedby={undefined}>
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
  return (
    <Button
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
