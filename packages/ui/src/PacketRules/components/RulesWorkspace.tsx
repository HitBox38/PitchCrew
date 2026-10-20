import { useState } from 'react';
import { Tabs } from '@/components/ui/tabs/components/Tabs.tsx';
import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';
import { TabsContent } from '@/components/ui/tabs/components/TabsContent.tsx';
import { parseDraft, fileIssues, issueText } from '../helpers.ts';
import { editableDocument } from '../form-helpers.ts';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';
import { RuleFormList } from './RuleFormList.tsx';
import { RulesEditor } from './RulesEditor.tsx';
import { RuleFileActions } from './RuleFileActions.tsx';

export const RulesWorkspace = ({ controller }: { controller: PacketRulesController }) => {
  const [mode, setMode] = useState(controller.state.error ? 'source' : 'form');
  const parsed = parseDraft(controller.text);
  const document = editableDocument('value' in parsed ? parsed.value : null);
  const issues = fileIssues(controller.issues);
  return (
    <Tabs
      value={document ? mode : 'source'}
      onValueChange={(value) => setMode(String(value))}
      className="gap-5"
    >
      <TabsList aria-label="Packet rules editor" className="w-fit flex-row">
        <TabsTrigger value="form" className="w-auto flex-none" disabled={!document}>
          Rule editor
        </TabsTrigger>
        <TabsTrigger value="source" className="w-auto flex-none">
          Advanced JSON
        </TabsTrigger>
      </TabsList>
      <TabsContent value="form">
        <p className="quiet mb-5">
          Set limits and checks for your packets. Changes apply only after you save.
        </p>
        {document ? <RuleFormList document={document} controller={controller} /> : null}
        {issues.length ? (
          <ul role="alert" className="form-error mt-4">
            {issues.map((issue, index) => (
              <li key={index}>{issueText(issue)}</li>
            ))}
          </ul>
        ) : null}
      </TabsContent>
      <TabsContent value="source">
        {!document ? (
          <p className="info-note mb-4">
            Fix the file’s JSON, version, rule types or 100-rule limit to use the form editor. Your
            source is preserved below.
          </p>
        ) : null}
        <RulesEditor controller={controller} />
        <RuleFileActions controller={controller} />
      </TabsContent>
    </Tabs>
  );
};
