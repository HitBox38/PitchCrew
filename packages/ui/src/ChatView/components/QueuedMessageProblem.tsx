import { QueueDiagnostics } from './QueueDiagnostics.tsx';

export const QueuedMessageProblem = ({ error }: { error: string }) => (
  <div className="chat-queued-problem">
    <p className="form-error" role="alert">
      That action could not finish. Review Details and try again.
    </p>
    <QueueDiagnostics entries={[{ label: 'Queued message action', text: error }]} />
  </div>
);
