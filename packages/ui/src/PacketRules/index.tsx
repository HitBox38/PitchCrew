import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { RulesActions } from './components/RulesActions.tsx';
import { RulesWorkspace } from './components/RulesWorkspace.tsx';
import { RulesIntro } from './components/RulesIntro.tsx';
import { usePacketRules } from './hooks/usePacketRules.ts';
import type { PacketRulesProps } from './types.ts';
import { useMarkdownSaveShortcut } from '@/components/MarkdownEditor/hooks/useMarkdownSaveShortcut.ts';

export const PacketRulesSettings = (props: PacketRulesProps) => {
  const controller = usePacketRules(props);
  const form = useMarkdownSaveShortcut();
  return (
    <section className="packet-rules" aria-labelledby="packet-rules-heading">
      <RulesIntro controller={controller} />
      <form
        ref={form}
        className="packet-rules-form"
        onSubmit={(event) => void controller.save(event)}
      >
        <div className="packet-rules-editor">
          <RulesWorkspace controller={controller} />
        </div>
        <RulesActions controller={controller} />
      </form>
      <DiscardChanges
        guard={controller.guard}
        finalFocus={() =>
          document.querySelector<HTMLElement>(
            '.packet-rules-editor [role="tab"][aria-selected="true"]',
          ) ?? false
        }
      />
    </section>
  );
};
