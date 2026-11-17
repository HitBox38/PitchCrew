import { FormSelect } from '@/FormSelect/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { browserModeLabels, browserModeSummaries } from '@pitchcrew/core/browser-modes';
import { savedBrowserMode } from '@/lib/browser-modes.ts';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { submissionAgentProblem } from '../submission.ts';
import type { PacketApprovalActionsProps } from '../types.ts';
import type { useSubmissionActions } from '../hooks/useSubmissionActions.ts';
type Props = {
  model: ReturnType<typeof useSubmissionActions>;
  data: PacketApprovalActionsProps['data'];
};
export const SubmissionChooser = ({ model, data }: Props) => {
  const role = data.roles.find((item) => item.id === model.roleId);
  // The chosen agent's saved default, in the words its settings use.
  const mode = savedBrowserMode(role);
  const problem = submissionAgentProblem(role, data);
  const agents = data.roles.filter(
    (item) => item.id === 'submitter' || !submissionAgentProblem(item, data),
  );
  return (
    <section className="submission-chooser" aria-label="Choose submission agent">
      <h3>Who should prepare this application?</h3>
      <FormSelect
        label="Submission agent"
        value={model.roleId}
        onValueChange={model.setRoleId}
        options={[
          ...(!agents.some((item) => item.id === 'submitter')
            ? [{ value: 'submitter', label: 'Submitter (unavailable)' }]
            : []),
          ...agents.map((item) => ({ value: item.id, label: item.name })),
        ]}
      />
      <p className="quiet">
        Browser: {browserModeLabels[mode]}. {browserModeSummaries[mode]} The agent marks the final
        submission so it waits for your approval.
      </p>
      {problem ? (
        <p className="text-ochre">{problem}</p>
      ) : (
        <p className="quiet">Browser, form assessment and submission receipt tools enabled.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={model.busy || !!problem} onClick={() => void model.start('agent')}>
          Start preparation
        </Button>
        {problem ? (
          <Button
            variant="outline"
            onClick={() => useWorkspaceStore.getState().setRoleId(role?.id ?? 'submitter')}
          >
            Set up {role?.name ?? 'Submitter'}
          </Button>
        ) : null}
        <Button variant="outline" disabled={model.busy} onClick={() => void model.start('manual')}>
          Export to apply myself
        </Button>
        <Button variant="ghost" onClick={() => model.setChooser(false)}>
          Cancel
        </Button>
      </div>
    </section>
  );
};
