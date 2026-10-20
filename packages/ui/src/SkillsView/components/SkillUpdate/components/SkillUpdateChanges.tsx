import { useMemo } from 'react';
import type { SkillUpdatePreview } from '@pitchcrew/core';
import { InstructionDiff } from '@/components/InstructionUpdate/components/InstructionDiff.tsx';
import { diffInstructions } from '@/components/InstructionUpdate/helpers.ts';

const SkillUpdateChanges = ({ review }: { review: SkillUpdatePreview }) => {
  const { current, latest } = review;
  const lines = useMemo(
    () => diffInstructions(current.content, latest.content),
    [current.content, latest.content],
  );
  const metadata = (['name', 'description'] as const).filter((key) => current[key] !== latest[key]);
  return (
    <div className="skill-update-changes">
      {metadata.map((key) => (
        <section key={key} aria-label={`${key} changes`}>
          <h3>{key === 'name' ? 'Name' : 'Description'}</h3>
          <p>
            <del>{current[key] || 'Empty'}</del>
          </p>
          <p>
            <ins>{latest[key] || 'Empty'}</ins>
          </p>
        </section>
      ))}
      <section aria-label="Instruction changes">
        <h3>Instructions</h3>
        {current.content !== latest.content ? (
          <InstructionDiff lines={lines} />
        ) : (
          <p className="quiet">Instructions are unchanged.</p>
        )}
      </section>
      {current.source?.blobSha !== latest.source?.blobSha ? (
        <p className="quiet">
          Source revision: {current.source?.blobSha.slice(0, 7)} →{' '}
          {latest.source?.blobSha.slice(0, 7)}
        </p>
      ) : null}
      {current.source?.repository !== latest.source?.repository ||
      current.source?.path !== latest.source?.path ? (
        <section aria-label="Source changes">
          <h3>Source</h3>
          <p>
            <del>
              {current.source?.repository}/{current.source?.path}
            </del>
          </p>
          <p>
            <ins>
              {latest.source?.repository}/{latest.source?.path}
            </ins>
          </p>
        </section>
      ) : null}
    </div>
  );
};
export default SkillUpdateChanges;
