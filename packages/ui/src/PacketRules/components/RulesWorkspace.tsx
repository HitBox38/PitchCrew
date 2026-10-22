import { keyedItems } from '@/lib/list-keys.ts';
import { lazy, Suspense, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { Tabs } from '@/components/ui/tabs/components/Tabs.tsx';
import { TabsList } from '@/components/ui/tabs/components/TabsList.tsx';
import { TabsTrigger } from '@/components/ui/tabs/components/TabsTrigger.tsx';
import { TabsContent } from '@/components/ui/tabs/components/TabsContent.tsx';
import { parseDraft, fileIssues, issueText } from '../helpers.ts';
import { editableDocument } from '../form-helpers.ts';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';
import { RuleFormList } from './RuleFormList.tsx';
import { RuleFileActions } from './RuleFileActions.tsx';

const RulesEditor = lazy(() =>
  import('./RulesEditor.tsx').then((module) => ({ default: module.RulesEditor })),
);

export const RulesWorkspace = ({ controller }: { controller: PacketRulesController }) => {
  const hash = useLocation({ select: (location) => location.hash });
  const [selection, setSelection] = useState({
    hash,
    mode: controller.state.error || hash === 'json-editor-settings' ? 'source' : 'form',
  });
  if (selection.hash !== hash)
    setSelection({ hash, mode: hash === 'json-editor-settings' ? 'source' : selection.mode });
  const mode = selection.mode;
  const parsed = parseDraft(controller.text);
  const document = editableDocument('value' in parsed ? parsed.value : null);
  const issues = fileIssues(controller.issues);
  const sourceActive = !document || mode === 'source';
  const [sourceVisited, setSourceVisited] = useState(sourceActive);
  if (sourceActive && !sourceVisited) setSourceVisited(true);
  return (
    <Tabs
      value={document ? mode : 'source'}
      onValueChange={(value) => setSelection({ hash, mode: String(value) })}
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
      <TabsContent value="form" keepMounted>
        <p className="quiet mb-5">Changes apply only after you save.</p>
        {document ? <RuleFormList document={document} controller={controller} /> : null}
        {issues.length ? (
          <ul role="alert" className="form-error mt-4">
            {keyedItems(issues, (issue) => JSON.stringify([issue.path, issue.message])).map(
              ({ item: issue, key }) => (
                <li key={key}>{issueText(issue)}</li>
              ),
            )}
          </ul>
        ) : null}
      </TabsContent>
      <TabsContent value="source" keepMounted>
        {!document ? (
          <p className="info-note mb-4">
            Fix the file’s JSON, version, rule types or 100-rule limit to use the form editor. Your
            source is preserved below.
          </p>
        ) : null}
        {sourceVisited ? (
          <Suspense fallback={<p className="quiet">Loading JSON editor…</p>}>
            <RulesEditor controller={controller} />
          </Suspense>
        ) : null}
        <RuleFileActions controller={controller} />
      </TabsContent>
    </Tabs>
  );
};
