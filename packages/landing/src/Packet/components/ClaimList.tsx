import { Bead } from '../../components/clay/Bead';
import { claims } from '../constants';

export const ClaimList = ({
  selected,
  onSelect,
  onEnter,
  onLeave,
}: {
  selected: string;
  onSelect: (id: string) => void;
  onEnter: (id: string, event: React.PointerEvent) => void;
  onLeave: () => void;
}) => {
  return (
    <div className="document" onPointerLeave={onLeave}>
      <p className="document-heading">Experience</p>
      <p className="document-sub">Frontend Engineer · Orbit Scheduling · 2022 to 2026</p>
      <fieldset className="claims">
        <legend className="sr-only">Resume lines. Choose one to read Reviewer’s check.</legend>
        {claims.map((claim) => (
          <label
            key={claim.id}
            className="claim"
            data-verdict={claim.verdict}
            data-selected={claim.id === selected ? '' : undefined}
            onPointerEnter={(event) => onEnter(claim.id, event)}
          >
            <input
              type="radio"
              name="claim"
              value={claim.id}
              className="sr-only"
              checked={claim.id === selected}
              onChange={() => onSelect(claim.id)}
            />
            <Bead tone={claim.verdict === 'quoted' ? 'moss' : 'primary'} />
            <span className="claim-text">{claim.text}</span>
            <span className="chip" data-tone={claim.verdict === 'quoted' ? 'moss' : 'primary'}>
              {claim.verdict === 'quoted' ? 'Quoted' : 'Revised'}
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
};
