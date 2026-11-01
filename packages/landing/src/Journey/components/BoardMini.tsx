import { Bead } from '../../components/clay/Bead';

const columns = [
  { name: 'Leads', cards: [{ company: 'Orbit Labs', title: 'Senior Frontend Engineer' }] },
  { name: 'Shortlisted', cards: [{ company: 'Northstar', title: 'Frontend Tech Lead' }] },
  {
    name: 'In progress',
    cards: [{ company: 'Waypoint', title: 'Senior UI Engineer', asks: true }],
  },
  {
    name: 'Applied',
    cards: [{ company: 'Forma', title: 'Design Engineer', outcome: 'Interviewing' }],
  },
];

/** The board after the Forma reply came in. */
export const BoardMini = () => {
  return (
    <div className="board-stage" data-ui="">
      <div className="tray board" aria-label="Fictional board">
        <p className="board-label fictional">Fictional board</p>
        {columns.map((column) => (
          <div key={column.name} className="board-column">
            <p className="board-column-name">
              {column.name} <span className="roster-count tabular">{column.cards.length}</span>
            </p>
            {column.cards.map((card) => (
              <article key={card.company} className="clay-card board-card">
                <p className="board-card-company">{card.company}</p>
                <p className="board-card-title">{card.title}</p>
                <p className="board-card-foot">
                  {'outcome' in card ? (
                    <>
                      <Bead tone="moss" size="sm" />
                      <span className="board-card-outcome">{card.outcome}</span>
                    </>
                  ) : 'asks' in card ? (
                    <>
                      <Bead tone="ochre" size="sm" />
                      <span className="board-card-asks">Waiting on you</span>
                    </>
                  ) : (
                    <>
                      <Bead size="sm" />
                      Idle
                    </>
                  )}
                </p>
              </article>
            ))}
          </div>
        ))}
      </div>
      <p className="board-insight">
        <Bead tone="moss" size="sm" />
        <span>
          Insights: <strong>Design systems</strong> tag, 2 of 3 decided applications positive. Your
          own lesson: “Lead with the accessibility work.”
        </span>
      </p>
    </div>
  );
};
