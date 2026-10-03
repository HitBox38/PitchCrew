import { useEffect, useRef } from 'react';
import { creationSteps } from '../constants.ts';
import type { CreationController } from '../types.ts';
import { PurposeStep } from './PurposeStep.tsx';
import { RuntimeStep } from './RuntimeStep.tsx';
import { ToolsStep } from './ToolsStep.tsx';
import { SkillsStep } from './SkillsStep.tsx';
import { RoutineStep } from './RoutineStep.tsx';
import { ReviewStep } from './ReviewStep.tsx';

export function CreationBody(props: CreationController) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    heading.current?.closest('.role-settings-body')?.scrollTo(0, 0);
    heading.current
      ?.closest('.creation-panel')
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [props.step]);
  return (
    <div className="role-settings-body creation-body">
      <h3 ref={heading} tabIndex={-1} className="mb-4 text-xl">
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
}
