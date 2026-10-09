import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';
import { CollapsibleTrigger } from '@/components/ui/collapsible/components/CollapsibleTrigger.tsx';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { ChevronDown, MessageCircleQuestion } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { QuestionAnswerForm } from './components/QuestionAnswerForm.tsx';
import { QuestionToaster } from './components/QuestionToaster.tsx';
import type { PendingQuestionsProps } from './types.ts';
export function PendingQuestions(props: PendingQuestionsProps) {
  const active =
    props.activeQuestionId === ''
      ? ''
      : props.questions.some((q) => q.id === props.activeQuestionId)
        ? props.activeQuestionId
        : props.questions[0]?.id;
  return (
    <AnimatePresence initial={false} key={props.thread}>
      {props.questions.length ? (
        <QuestionToaster key="questions" reduced={props.reduced}>
          {props.questions.map((question) => (
            <Collapsible
              key={question.id}
              open={active === question.id}
              onOpenChange={(open) => props.setActiveQuestionId(open ? question.id : '')}
              className="pending-user-question"
            >
              <CollapsibleTrigger className="pending-question-trigger">
                <RoleAvatar agentRole={question.roleId} size="small" />
                <span className="pending-question-label">
                  <strong>
                    {props.data.roles.find((role) => role.id === question.roleId)?.name ??
                      question.roleId}
                  </strong>{' '}
                  is waiting for you
                </span>
                <MessageCircleQuestion size={15} />
                <ChevronDown className="pending-question-chevron" size={15} />
              </CollapsibleTrigger>
              <CollapsibleContent keepMounted>
                <QuestionAnswerForm
                  question={question}
                  action={props.action}
                  working={props.working}
                />
              </CollapsibleContent>
            </Collapsible>
          ))}
        </QuestionToaster>
      ) : null}
    </AnimatePresence>
  );
}
