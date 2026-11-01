import type { PacketRulesController } from '../hooks/usePacketRules.ts';
import { RuleFileActions } from './RuleFileActions.tsx';

export const RulesIntro = ({ controller }: { controller: PacketRulesController }) => {
  const { state, rules } = controller;
  return (
    <header className="packet-rules-intro">
      <div className="settings-section-head">
        <h2 id="packet-rules-heading" className="ui-section-heading" tabIndex={-1}>
          Packet rules <span className="ui-count">{rules.length}</span>
        </h2>
        <div className="settings-section-actions">
          <RuleFileActions controller={controller} />
        </div>
      </div>
      {state.error ? (
        <p className="form-error" role="alert">
          {state.error} Checks stay blocked until you save valid rules or restore the defaults. The
          editor shows fallback rules for repair.
        </p>
      ) : (
        <p className="settings-section-note">
          {state.custom
            ? 'Your saved rules apply to future drafts, reviews and exports. Exact quotation checks always apply.'
            : 'Using the default limits. Exact quotation checks always apply.'}
        </p>
      )}
    </header>
  );
};
