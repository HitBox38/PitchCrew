import { useEffect, useRef } from 'react';
import { creationSteps } from '../constants.ts';
import type { CreationController } from '../types.ts';
import { PurposeStep } from './PurposeStep.tsx';
import { RuntimeStep } from './RuntimeStep.tsx';
import { ToolsStep } from './ToolsStep.tsx';
import { SkillsStep } from './SkillsStep.tsx';
import { RoutineStep } from './RoutineStep.tsx';
import { ReviewStep } from './ReviewStep.tsx';

export const CreationBody = (props: CreationController) => {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    heading.current?.closest('.agent-wizard-body')?.scrollTo(0, 0);
  }, [props.step]);
  return (
    <div className="agent-wizard-body">
      <h3 ref={heading} tabIndex={-1} className="agent-wizard-step-heading">
        {creationSteps[props.step]}
      </h3>
      {props.step === 0 ? <PurposeStep {...props} /> : null}
      {props.step === 1 ? <RuntimeStep {...props} /> : null}
      {props.step === 2 ? <ToolsStep {...props} /> : null}
      {props.step === 3 ? <SkillsStep {...props} /> : null}
      {props.step === 4 ? <RoutineStep {...props} /> : null}
      {props.step === 5 ? <ReviewStep {...props} /> : null}
    </div>
  );
};
