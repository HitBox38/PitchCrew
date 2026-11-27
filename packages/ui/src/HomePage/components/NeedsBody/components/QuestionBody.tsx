import { Link } from '@tanstack/react-router';
import { Button } from '@pitchcrew/design-system/button';
import { QuestionAnswerForm } from '@/UserQuestions/components/QuestionAnswerForm.tsx';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { questionGate } from '../../../constants.ts';
import { useDeskTools } from '../../../hooks/useDeskTools.ts';
import type { BodyProps } from '../../../types.ts';
import { OpenHeader } from './OpenHeader.tsx';
import { WaitingOn } from './WaitingOn.tsx';

/**
 * A question, answered in place with the form chat and job details share, in the desk's order: the
 * question as the headline and why it is asked, who asked, what waits, then the suggestions, the
 * detail field and Answer and continue first, with the consequence under them (the form's own
 * title and reason give way to the headline and evidence here). A choice never sends itself
 * (`answerOnSubmit`): a click or 1–9 key only selects, typed detail keeps it, and only Answer and
 * continue posts. The keys act only while focus is inside the form, never from the row's trigger,
 * which takes focus after each decision.
 */
export const QuestionBody = ({ item, data, open, focusWithin }: BodyProps) => {
  const { act, resolved } = useDeskTools();
  const working = useWorkspaceStore((state) => state.working);
  const question = data.userInputs?.find((entry) => entry.id === item.entityId);
  if (!question) return null;
  return (
    <>
      <OpenHeader item={item} data={data}>
        {question.reason ? <p className="needs-note">{question.reason}</p> : null}
      </OpenHeader>
      <WaitingOn item={item} data={data} />
      <QuestionAnswerForm
        question={question}
        action={act({ item, data })}
        working={working}
        active={open && focusWithin}
        answerOnSubmit
        answerFirst
        onResolved={resolved}
      />
      <p className="needs-gate">{questionGate}</p>
      {item.threadId ? (
        <Button
          variant="ghost"
          className="needs-link"
          nativeButton={false}
          render={<Link to="/chat/$thread" params={{ thread: item.threadId }} />}
        >
          Open the conversation
        </Button>
      ) : null}
    </>
  );
};
