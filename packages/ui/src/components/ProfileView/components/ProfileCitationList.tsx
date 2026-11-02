import { ProfileCitation, type CitationRow } from './ProfileCitation.tsx';

/** One row per citing packet, shared by the rail and the narrow-screen popover. */
export const ProfileCitationList = ({
  rows,
  content,
  reveal,
}: {
  rows: CitationRow[];
  content: string;
  reveal: (quote: string) => void;
}) => {
  return (
    <ul className="profile-citation-list">
      {rows.map((card) => (
        <ProfileCitation key={card.id} card={card} content={content} reveal={reveal} />
      ))}
    </ul>
  );
};
