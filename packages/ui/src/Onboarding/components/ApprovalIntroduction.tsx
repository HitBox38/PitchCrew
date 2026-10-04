import { FileText, FolderCheck, ShieldCheck } from 'lucide-react';

export function ApprovalIntroduction() {
  return (
    <div className="grid gap-5">
      <div
        className="onboarding-handoff flex items-center justify-center gap-5 py-6"
        aria-hidden="true"
      >
        <FileText size={32} />
        <span className="h-px w-9 bg-border" />
        <ShieldCheck size={44} />
        <span className="h-px w-9 bg-border" />
        <FolderCheck size={32} />
      </div>
      <p className="text-sm leading-relaxed text-ink-soft">
        The crew works when you ask. You review the exact application packet before approving a
        local export, then submit it yourself.
      </p>
      <p className="text-sm leading-relaxed text-ink-soft">
        Optional browser actions need your approval each time. Account connections and scheduled
        routines are optional, and you choose which tools each agent can use.
      </p>
      <p className="onboarding-local rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
        Your profile, board and drafts are saved on this device. Agent runs use the AI runtime you
        configure.
      </p>
    </div>
  );
}
