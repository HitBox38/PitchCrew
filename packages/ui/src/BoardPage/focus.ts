export const jobFocusTarget = (id: string) => {
  const jobs = [...document.querySelectorAll<HTMLElement>('.draggable-job')];
  const index = jobs.findIndex((job) => job.id === `board-job-${id}`);
  return { id, fallback: (jobs[index + 1] ?? jobs[index - 1])?.id };
};

export const restoreJobFocus = (target: ReturnType<typeof jobFocusTarget>, state?: string) => {
  const node =
    document.querySelector(`#board-job-${CSS.escape(target.id)}[data-card-state="${state}"]`) ??
    (target.fallback ? document.getElementById(target.fallback) : null);
  const button =
    node?.querySelector<HTMLButtonElement>('.job-actions-trigger:not(:disabled)') ??
    document.querySelector<HTMLButtonElement>('.board-segment [aria-pressed="true"]') ??
    document.querySelector<HTMLButtonElement>('.board-add-job');
  button?.focus({ preventScroll: true });
};

/** Wait for the jumped-to column to mount, then centre it, focus its heading and flash it. */
export const focusStage = (id: string, tries = 10) => {
  requestAnimationFrame(() => {
    const column = document.getElementById(`stage-${id}`);
    if (!column) return tries ? focusStage(id, tries - 1) : undefined;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    column.scrollIntoView({
      behavior: reduced ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
    column.querySelector<HTMLElement>('[data-stage-heading]')?.focus({ preventScroll: true });
    column.dataset.flash = '';
    setTimeout(() => delete column.dataset.flash, 1400);
  });
};
