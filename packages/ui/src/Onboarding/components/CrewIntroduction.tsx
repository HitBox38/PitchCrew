import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';

const seats = [
  { id: 'scout', name: 'Scout', task: 'Scores the fit against your profile.' },
  {
    id: 'writer',
    name: 'Writer',
    task: 'Drafts a resume, cover letter and answers from your notes.',
  },
  { id: 'reviewer', name: 'Reviewer', task: 'Checks every claim against those notes.' },
] as const;

/** Screen one: the three workflow agents, one line each. */
export const CrewIntroduction = () => (
  <ol className="onboarding-crew">
    {seats.map((seat) => (
      <li key={seat.id}>
        <RoleAvatar agentRole={seat.id} />
        <strong>{seat.name}</strong>
        <span>{seat.task}</span>
      </li>
    ))}
  </ol>
);
