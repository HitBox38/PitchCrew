import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { RuleList } from './components/RuleList.tsx';
import { RulesActions } from './components/RulesActions.tsx';
import { RulesEditor } from './components/RulesEditor.tsx';
import { RulesIntro } from './components/RulesIntro.tsx';
import { usePacketRules } from './hooks/usePacketRules.ts';
import type { PacketRulesProps } from './types.ts';

export function PacketRulesSettings(props: PacketRulesProps) {
  const controller = usePacketRules(props);
  return (
    <section className="settings-section packet-rules" aria-labelledby="packet-rules-heading">
      <RulesIntro state={controller.state} />
      <RuleList rules={controller.rules} issues={controller.issues} />
      <form className="packet-rules-form" onSubmit={(event) => void controller.save(event)}>
        <RulesEditor controller={controller} />
        <RulesActions controller={controller} />
      </form>
      <DiscardChanges guard={controller.guard} />
    </section>
  );
}
