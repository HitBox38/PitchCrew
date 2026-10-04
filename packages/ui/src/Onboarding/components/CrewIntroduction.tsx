import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';

const seats = [
  {
    id: 'scout',
    name: 'Scout',
    task: 'Find your fit',
    detail: 'Compares a job post with your experience and goals.',
  },
  {
    id: 'writer',
    name: 'Writer',
    task: 'Tell your story',
    detail: 'Drafts your resume, cover letter and form answers from your profile.',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    task: 'Check the details',
    detail: 'Checks the draft and its claims against your saved notes.',
  },
] as const;

export function CrewIntroduction() {
  return (
    <ol className="onboarding-crew grid gap-4">
      {seats.map((seat) => (
        <li key={seat.id} className="flex items-start gap-4">
          <RoleAvatar agentRole={seat.id} size="large" />
          <div>
            <p className="flex flex-wrap items-baseline gap-x-3">
              <strong>{seat.name}</strong>
              <span>{seat.task}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{seat.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
