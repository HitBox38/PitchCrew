import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@pitchcrew/design-system/dropdown-menu';
import { Paperclip, BriefcaseBusiness, Users } from 'lucide-react';

export const ComposerContextItems = ({
  attached,
  available,
  jobLocked,
  canDelegate,
  onFiles,
  onJob,
  onDelegate,
}: {
  attached: boolean;
  available: boolean;
  jobLocked: boolean;
  canDelegate: boolean;
  onFiles: () => void;
  onJob: () => void;
  onDelegate: () => void;
}) => (
  <DropdownMenuContent side="top" align="start" className="w-64">
    <DropdownMenuItem onClick={onFiles} disabled={!available}>
      <Paperclip />
      <span className="grid gap-0.5">
        <span>Add files…</span>
        <span className="text-xs text-muted-foreground">
          For this message · up to 5 files, 10 MB
        </span>
      </span>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem disabled={jobLocked} onClick={onJob}>
      <BriefcaseBusiness />
      <span className="grid gap-0.5">
        <span>{attached ? 'Change conversation job…' : 'Attach a job…'}</span>
        <span className="text-xs text-muted-foreground">
          {jobLocked ? 'Fixed after the first message' : 'For the whole conversation'}
        </span>
      </span>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem disabled={!canDelegate} onClick={onDelegate}>
      <Users />
      <span className="grid gap-0.5">
        <span>Delegate to several agents…</span>
        <span className="text-xs text-muted-foreground">
          This message goes to each; the lead collects their results
        </span>
      </span>
    </DropdownMenuItem>
  </DropdownMenuContent>
);
