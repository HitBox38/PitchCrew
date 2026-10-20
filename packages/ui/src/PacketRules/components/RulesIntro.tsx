import type { PacketRulesState } from '@pitchcrew/core';

export const RulesIntro = ({ state }: { state: PacketRulesState }) => {
  return (
    <>
      <h2 id="packet-rules-heading">Packet rules</h2>
      <p className="quiet max-w-[72ch]">
        Set limits and checks for drafts, reviews and exports. Choose whether each rule blocks a
        packet or shows a warning. Only you can change these rules; exact quotation checks always
        apply.
      </p>
      {state.error ? (
        <p className="form-error mt-3" role="alert">
          {state.error} Checks stay blocked until you save valid rules or restore the defaults. The
          editor shows fallback rules for repair.
        </p>
      ) : (
        <p className="info-note">
          {state.custom
            ? 'Your saved rules apply to future packet checks.'
            : 'Using default limits. Edit a rule or add your own, then save.'}
        </p>
      )}
    </>
  );
};
