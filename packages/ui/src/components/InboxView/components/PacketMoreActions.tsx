import { Ellipsis } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';
import type { PacketActionProps } from './PacketDecisionActions.tsx';

/** Less common packet choices: reject outright, stop applying, ask for changes, open the job. */
export const PacketMoreActions = ({
  approval,
  card,
  action,
  onOpen,
  disabled,
  model,
}: PacketActionProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="ghost" aria-label="More packet actions" />}>
      <Ellipsis size={16} /> <span className="decide-more-label">More</span>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuGroup>
        {approval.status === 'pending' ? (
          <DropdownMenuItem
            disabled={disabled}
            onClick={() =>
              void model.perform(() =>
                action(`/approvals/${approval.id}/decide`, 'POST', { approved: false }),
              )
            }
          >
            Reject packet
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled={disabled} onClick={() => void model.askWriter()}>
            Request changes
          </DropdownMenuItem>
        )}
        <DropdownMenuItem disabled={disabled} onClick={() => model.setConfirmWithdraw(true)}>
          Not applying
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpen(card.id)}>Open job</DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);
