import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { QuestionAnswerForm } from './components/QuestionAnswerForm.tsx';
import { QuestionToaster } from './components/QuestionToaster.tsx';
import type { PendingQuestionsProps } from './types.ts';
import { StatusBead } from '@/ClayInterface/components/StatusBead.tsx';
import { activeQuestion } from './helpers.ts';
import { useQuestionReveal } from './hooks/useQuestionReveal.ts';
import { QuestionResponseRecoveries } from './components/QuestionResponseRecoveries.tsx';
export const PendingQuestions = (props: PendingQuestionsProps) => {
  const active = activeQuestion(props.questions, props.activeQuestionId);
  useQuestionReveal(active || undefined);
  return (
    <>
      <QuestionResponseRecoveries thread={props.thread} />
      <AnimatePresence initial={false} key={props.thread}>
        {props.questions.length ? (
          <QuestionToaster key="questions" reduced={props.reduced}>
            {props.questions.map((question) => (
              <Collapsible
                key={question.id}
                open={active === question.id}
                onOpenChange={(open) => props.setActiveQuestionId(open ? question.id : '')}
                className="pending-user-question"
                data-question-id={question.id}
              >
                <CollapsibleTrigger className="pending-question-trigger">
                  <RoleAvatar agentRole={question.roleId} size="small" />
                  <span className="pending-question-label">
                    <strong>
                      {props.data.roles.find((role) => role.id === question.roleId)?.name ??
                        question.roleId}
                    </strong>{' '}
                    asks{' '}
                    <span className="pending-question-preview" title={question.question}>
                      {question.question}
                    </span>
                  </span>
                  <StatusBead status="waiting" />
                  <ChevronDown className="pending-question-chevron" size={15} />
                </CollapsibleTrigger>
                <CollapsibleContent keepMounted>
                  <QuestionAnswerForm
                    question={question}
                    action={props.action}
                    working={props.working}
                    active={active === question.id}
                  />
                </CollapsibleContent>
              </Collapsible>
            ))}
          </QuestionToaster>
        ) : null}
      </AnimatePresence>
    </>
  );
};
