import type { PacketRulesState } from '@pitchcrew/core';

export function RulesIntro({ state }: { state: PacketRulesState }) {
  return (
    <>
      <h2 id="packet-rules-heading">Packet rules</h2>
      <p className="quiet max-w-[72ch]">
        Pitchcrew checks every draft, review and export against these rules, after the exact
        quotation checks. Errors block the packet. Warnings appear in review notes and never block.
        Agents can read the rules; only you can change them.
      </p>
      {state.error ? (
        <p className="form-error mt-3" role="alert">
          {state.error} Every check fails until you save valid rules or restore the defaults.
        </p>
      ) : (
        <p className="info-note">
          {state.custom
            ? 'Using packet-rules.json from your data folder.'
            : 'Using the built-in defaults. Saving creates packet-rules.json in your data folder.'}
        </p>
      )}
    </>
  );
}
