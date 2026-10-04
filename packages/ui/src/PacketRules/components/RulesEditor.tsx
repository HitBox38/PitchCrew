import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import { fileIssues, issueText } from '../helpers.ts';
import type { PacketRulesController } from '../hooks/usePacketRules.ts';

export function RulesEditor({ controller }: { controller: PacketRulesController }) {
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
      <div className="mt-6 mb-2 flex items-center justify-between gap-3">
        <label className="font-semibold" htmlFor="packet-rules-json">
          Rules file (JSON)
        </label>
        <output className="quiet" aria-live="polite">
          {status}
        </output>
      </div>
      <Textarea
        id="packet-rules-json"
        className="packet-rules-json"
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        rows={18}
        aria-invalid={issues.length > 0}
        aria-describedby={general.length ? 'packet-rules-problems' : undefined}
      />
      {general.length ? (
        <ul id="packet-rules-problems" className="form-error mt-2" role="alert">
          {general.map((issue, index) => (
            <li key={index}>{issueText(issue)}</li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
