import type { BrowserAction } from '@pitchcrew/core';
import { actionFields } from '../helpers.ts';

export function BrowserActionSummary({ action }: { action: BrowserAction }) {
  return (
    <>
      <dl className="browser-action-summary">
        {actionFields(action).map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value === '' ? <em>Empty text</em> : value}</dd>
          </div>
        ))}
      </dl>
      <details className="approval-preview">
        <summary>Exact action details</summary>
        <pre>{JSON.stringify(action, null, 2)}</pre>
      </details>
    </>
  );
}
