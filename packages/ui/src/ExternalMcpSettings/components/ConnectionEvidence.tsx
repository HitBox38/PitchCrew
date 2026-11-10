import type { ExternalMcpInfo } from '@pitchcrew/core';
import { settingsTime } from '@/lib/settings-time.ts';

export const ConnectionEvidence = ({ info }: { info: ExternalMcpInfo }) => {
  const attempt = info.lastAttempt;
  const problem = attempt && attempt.outcome !== 'succeeded' ? attempt : null;
  const evidence = problem ?? info.lastRequest;
  return (
    <output>
      <strong>
        {problem
          ? problem.outcome === 'read-only'
            ? 'Request blocked: changes are off'
            : 'Request could not finish'
          : info.lastRequest
            ? 'Request received'
            : 'Waiting for your app’s first request'}
      </strong>
      {evidence ? (
        <p className="quiet">
          <code>pitchcrew_{evidence.action}</code>{' '}
          <time dateTime={evidence.at}>{settingsTime(evidence.at)}</time>.
        </p>
      ) : null}
      <p className="quiet">
        {problem
          ? problem.outcome === 'read-only'
            ? 'Enable changes above if you want this app to change jobs or message your crew, then reconnect it.'
            : 'Read the error in your app. Check a timed-out write’s result before retrying it.'
          : info.lastRequest
            ? 'The request reached Pitchcrew successfully.'
            : 'Send the prompt, then watch here. Checks update automatically.'}
      </p>
    </output>
  );
};
