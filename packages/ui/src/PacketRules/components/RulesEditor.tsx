import { keyedItems } from '@/lib/list-keys.ts';
import { JsonEditor } from '@/JsonEditor/index.tsx';
import { completePacketRules } from '../completions.ts';
import { fileIssues, issueText } from '../helpers.ts';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';

export const RulesEditor = ({ controller }: { controller: PacketRulesController }) => {
  const { text, setText, dirty, checking, issues } = controller;
  const general = fileIssues(issues);
  const status = checking
    ? 'Checking…'
    : !dirty
      ? 'Saved'
      : issues.length
        ? `${issues.length} ${issues.length === 1 ? 'problem' : 'problems'} to fix`
        : 'Ready to save';
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="font-semibold">Rules file (JSON)</span>
        <output className="badge" aria-live="polite">
          {status}
        </output>
      </div>
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
        <ul id="packet-rules-problems" className="form-error mt-2" role="alert">
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
