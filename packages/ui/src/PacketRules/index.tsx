import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { RuleList } from './components/RuleList.tsx';
import { RulesActions } from './components/RulesActions.tsx';
import { RulesEditor } from './components/RulesEditor.tsx';
import { RulesIntro } from './components/RulesIntro.tsx';
import { usePacketRules } from './hooks/usePacketRules.ts';
import type { PacketRulesProps } from './types.ts';

export const PacketRulesSettings = (props: PacketRulesProps) => {
  const controller = usePacketRules(props);
  return (
    <section className="settings-section packet-rules" aria-labelledby="packet-rules-heading">
      <div className="packet-rules-intro">
        <RulesIntro state={controller.state} />
      </div>
      <div className="packet-rules-workspace">
        <aside className="packet-rules-summary" aria-label="Rules overview">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3>Rules overview</h3>
            <span className="badge">{controller.rules.length} rules</span>
          </div>
          <RuleList rules={controller.rules} issues={controller.issues} />
        </aside>
        <form className="packet-rules-form" onSubmit={(event) => void controller.save(event)}>
          <div className="packet-rules-editor">
            <RulesEditor controller={controller} />
          </div>
          <RulesActions controller={controller} />
        </form>
      </div>
      <DiscardChanges guard={controller.guard} />
    </section>
  );
};
