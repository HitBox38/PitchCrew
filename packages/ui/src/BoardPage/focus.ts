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
    document.querySelector<HTMLButtonElement>('.board-toolbar .view-switch .active') ??
    document.querySelector<HTMLButtonElement>('.board-workspace .welcome .button.primary');
  button?.focus({ preventScroll: true });
};
