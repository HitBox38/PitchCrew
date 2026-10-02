import { AnimatePresence, LayoutGroup } from 'motion/react';
import * as m from 'motion/react-m';
import { useAppReducedMotion } from './motion.tsx';
import { useEffect } from 'react';
import { Plus, Search, X, LoaderCircle, ArrowRight } from 'lucide-react';
import { Input } from './components/ui/input.tsx';
import { Button } from './components/ui/button.tsx';
import { EmptyState, JobCard, RoleAvatar, timeAgo } from './components.tsx';
import { useShallow } from 'zustand/react/shallow';
import { useWorkspaceStore } from './workspace-store.ts';
import { useWorkspaceNavigation } from './workspace-navigation.ts';
import { closedStates, stages } from './board-stages.ts';

export function BoardPage() {
  const reduced = useAppReducedMotion();
  const {
    data,
    working,
    act,
    openCard,
    setAdd,
    query,
    setQuery,
    showClosed,
    setShowClosed,
    flashStage,
    setFlashStage,
  } = useWorkspaceStore(
    useShallow((state) => ({
      data: state.data,
      working: state.working,
      act: state.act,
      openCard: state.openCard,
      setAdd: state.setAdd,
      query: state.query,
      setQuery: state.setQuery,
      showClosed: state.showClosed,
      setShowClosed: state.setShowClosed,
      flashStage: state.flashStage,
      setFlashStage: state.setFlashStage,
    })),
  );
  const { go } = useWorkspaceNavigation();
  useEffect(() => {
    if (!flashStage) return;
    document.getElementById(`stage-${flashStage}`)?.scrollIntoView({
      behavior: reduced ? 'instant' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
    const timer = setTimeout(() => setFlashStage(null), 1400);
    return () => clearTimeout(timer);
  }, [flashStage, setFlashStage, reduced]);
  if (!data) return null;
  const active = data.cards.filter((c) => !closedStates.includes(c.state));
  const filtered = data.cards.filter((c) =>
    `${c.company} ${c.title} ${c.location} ${c.tags.join(' ')}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const closed = filtered.filter((c) => closedStates.includes(c.state));
  const recent = data.events.filter((e) => e.kind !== 'role').slice(0, 4);
  return (
    <>
      {!data.cards.length ? (
        <section className="welcome">
          <h2>Start with a job post</h2>
          <p>
            Add a listing you’re considering. The crew works on it one step at a time, and only when
            you ask.
          </p>
          <ol className="welcome-steps">
            <li>
              <RoleAvatar agentRole="scout" size="small" />
              <span>
                <strong>Scout</strong> reads the post and scores the fit against your profile.
              </span>
            </li>
            <li>
              <RoleAvatar agentRole="writer" size="small" />
              <span>
                <strong>Writer</strong> drafts a resume, cover letter and form answers, quoting only
                your notes.
              </span>
            </li>
            <li>
              <RoleAvatar agentRole="reviewer" size="small" />
              <span>
                <strong>Reviewer</strong> checks every claim against those notes.
              </span>
            </li>
            <li>
              <span className="step-you">You</span>
              <span>
                approve the exact packet before it’s exported to a folder. Browser interactions
                require your approval.
              </span>
            </li>
          </ol>
          <div className="welcome-actions">
            <Button className="button primary" onClick={() => setAdd(true)}>
              <Plus size={16} /> Add job
            </Button>
            <Button
              className="button"
              disabled={working}
              onClick={() =>
                act('/examples', 'POST', undefined, 'Loaded example jobs (demo runtime)')
              }
            >
              {working ? <LoaderCircle size={14} className="spin" /> : null} Load example data
            </Button>
          </div>
        </section>
      ) : (
        <>
          <div className="board-toolbar">
            <div className="view-switch">
              <Button className={!showClosed ? 'active' : ''} onClick={() => setShowClosed(false)}>
                Pipeline
              </Button>
              <Button className={showClosed ? 'active' : ''} onClick={() => setShowClosed(true)}>
                Closed <span>{data.cards.length - active.length}</span>
              </Button>
            </div>
            <div className="search-input">
              <Search size={15} />
              <Input
                aria-label="Search jobs"
                placeholder="Filter by company, title, tag"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <Button
                  className="icon-button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </Button>
              ) : null}
            </div>
          </div>
          {showClosed ? (
            <LayoutGroup id="closed-jobs">
              <m.div layout className="closed-grid">
                <AnimatePresence initial={false}>
                  {closed.length ? (
                    closed.map((card) => (
                      <JobCard key={card.id} card={card} onOpen={() => openCard(card.id)} />
                    ))
                  ) : (
                    <EmptyState
                      title="Nothing closed"
                      description="Rejected, withdrawn and unanswered applications end up here."
                    />
                  )}
                </AnimatePresence>
              </m.div>
            </LayoutGroup>
          ) : (
            <LayoutGroup id="pipeline-jobs">
              <m.div layoutScroll className="pipeline" aria-label="Application pipeline">
                {stages.map((stage) => {
                  const cards = filtered.filter((c) => stage.states.includes(c.state));
                  return (
                    <section
                      className={`pipeline-column ${stage.color} ${flashStage === stage.id ? 'flash' : ''}`}
                      id={`stage-${stage.id}`}
                      key={stage.id}
                    >
                      <div className="column-heading">
                        <span className="stage-dot" />
                        <h2>{stage.label}</h2>
                        <span className="column-count">{cards.length}</span>
                        {stage.id === 'lead' ? (
                          <Button
                            className="icon-button"
                            aria-label="Add a job"
                            onClick={() => setAdd(true)}
                          >
                            <Plus size={15} />
                          </Button>
                        ) : null}
                      </div>
                      <div className="column-cards">
                        <AnimatePresence initial={false}>
                          {cards.map((card) => (
                            <JobCard key={card.id} card={card} onOpen={() => openCard(card.id)} />
                          ))}
                        </AnimatePresence>
                        {!cards.length ? (
                          <p className="column-empty">{query ? 'No matches.' : stage.empty}</p>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </m.div>
            </LayoutGroup>
          )}
          {recent.length ? (
            <section className="recent">
              <div className="section-heading">
                <h2>Recent</h2>
                <Button className="text-button" onClick={() => go('activity')}>
                  All activity <ArrowRight size={13} />
                </Button>
              </div>
              <ul>
                {recent.map((event) => (
                  <li key={event.id}>
                    <span>{event.message}</span>
                    <time dateTime={event.createdAt}>{timeAgo(event.createdAt)}</time>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
