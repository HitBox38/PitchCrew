import { Kbd } from '@pitchcrew/design-system/kbd';

/**
 * The decide shortcut's quiet hint inside a glaze verb, in the verb's own ink, as the Profile's
 * Save shows its keys. Phones, coarse pointers and narrow decision bodies (the `decide` container)
 * drop it so the verbs keep their room; the keys stay in the verb's title and `aria-keyshortcuts`.
 */
export const DecideHint = ({ label }: { label: string }) => (
  <Kbd
    aria-hidden="true"
    className="decide-kbd ml-0.5 h-[18px] bg-current/14 text-inherit max-mobile:hidden @max-[640px]/decide:hidden pointer-coarse:hidden"
  >
    {label}
  </Kbd>
);
