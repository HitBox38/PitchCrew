import { Bead } from '@/ClayInterface/components/Bead.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import type { LensRow } from '@/lib/crew-lens.ts';

/**
 * The agent's identity pebble with one state bead on its rim: ochre while something waits on the
 * user, rose when work failed, plum while it runs, an empty socket otherwise. Only an executing
 * run makes the pebble breathe; a wait on the user stays still.
 */
export const LensPebble = ({ row, small = false }: { row: LensRow; small?: boolean }) => (
  <span className="crew-pebble crew-lens-pebble" data-live={row.live ? '' : undefined}>
    <RoleAvatar agentRole={row.roleId} size={small ? 'small' : 'normal'} />
    <Bead tone={row.pebble} className="crew-pebble-bead" />
  </span>
);
