import { keyedItems } from '@/lib/list-keys.ts';
import { JsonEditor } from '@/JsonEditor/index.tsx';
import { completePacketRules } from '../completions.ts';
import { fileIssues, issueText } from '../helpers.ts';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';

export const RulesEditor = ({ controller }: { controller: PacketRulesController }) => {
  const { text, setText, issues } = controller;
  const general = fileIssues(issues);
  return (
    <>
      <JsonEditor
        id="packet-rules-json"
        label="Rules file (JSON)"
        filename="packet-rules.json"
        value={text}
        onChange={setText}
        issues={issues}
        complete={completePacketRules}
      />
      {general.length ? (
        <ul id="packet-rules-problems" className="form-error packet-rules-problems" role="alert">
          {keyedItems(general, (issue) => JSON.stringify([issue.path, issue.message])).map(
            ({ item: issue, key }) => (
              <li key={key}>{issueText(issue)}</li>
            ),
          )}
        </ul>
      ) : null}
    </>
  );
};
