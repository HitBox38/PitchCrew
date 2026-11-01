import type { CapabilityChangesProps } from '@/ChatWork/types.ts';
import { capabilityDiff } from '@/ChatWork/summary.ts';

const Bead = ({ on }: { on: boolean }) => (
  <span
    className="clay-bead"
    data-size="sm"
    data-tone={on ? 'moss' : undefined}
    data-empty={on ? undefined : ''}
    aria-hidden="true"
  />
);

/** Only the capabilities that would change, each as an on/off bead before and after. */
export const ClayCapabilityChanges = ({ current, changes }: CapabilityChangesProps) => {
  const { changed, unchanged } = capabilityDiff(current, changes);
  return (
    <div className="clay-proposal-tray">
      {changed.length ? (
        <ul className="clay-capability-changes">
          {changed.map((item) => (
            <li key={item.key}>
              <span>{item.label}</span>
              <span className="clay-capability-shift">
                <Bead on={item.before} />
                <span className="sr-only">{item.before ? 'Enabled' : 'Disabled'} to</span>
                <span aria-hidden="true">→</span>
                <Bead on={item.after} />
                <strong>{item.after ? 'On' : 'Off'}</strong>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {unchanged ? (
        <p className="clay-proposal-quiet">
          {changed.length ? 'The other' : 'All'} {unchanged}{' '}
          {unchanged === 1 ? 'capability stays' : 'capabilities stay'} as they are.
        </p>
      ) : null}
    </div>
  );
};
