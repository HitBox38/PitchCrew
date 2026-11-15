/** The faded edge of the tab strip, in pixels. */
const fade = 12;
const padded = new WeakMap<HTMLElement, HTMLElement>();

/**
 * Brings the open note's tab fully into view, like a code editor: a tab that is already in view
 * never moves. When the strip must scroll, its left edge settles on a tab's start, so a tab half
 * out of the strip never shows just its close button or a clipped word.
 */
export const revealTab = (lane: HTMLElement) => {
  const tab = lane.querySelector<HTMLElement>('[data-selected="true"]');
  if (!tab) return;
  // Room added past the end for one tab stays while that tab is open, so repeated reveals (a
  // resize, a re-render) keep the alignment; another tab starts from the plain strip.
  if (padded.get(lane) !== tab) {
    lane.style.paddingInlineEnd = '';
    padded.delete(lane);
  }
  const left = lane.getBoundingClientRect().left;
  const edge = (element: Element) => element.getBoundingClientRect().left - left + lane.scrollLeft;
  const start = edge(tab);
  const end = start + tab.offsetWidth;
  const scrolled = lane.scrollLeft;
  // The faded edges only hide anything where the strip can scroll further.
  const shownFrom = scrolled + (scrolled > 0 ? fade : 0);
  const shownTo =
    scrolled + lane.clientWidth - (scrolled + lane.clientWidth < lane.scrollWidth - 1 ? fade : 0);
  if (start >= shownFrom - 1 && end <= shownTo + 1) return;
  const most = lane.scrollWidth - lane.clientWidth;
  let next = scrolled;
  if (end > shownTo) next = end - lane.clientWidth + fade;
  if (start < next + fade) next = start - fade;
  next = Math.min(Math.max(0, next), most);
  // Never leave a tab half out at the left edge: move on to the next tab's start, or back to
  // this one's when the strip cannot scroll that far (the last tab), as long as the open tab
  // stays in view either way.
  const cutAt = (at: number) =>
    [...lane.querySelectorAll<HTMLElement>('.profile-tab-item')].find((item) => {
      const from = edge(item);
      return item !== tab && from < at + fade && from + item.offsetWidth > at + fade;
    });
  const cut = next > 0 ? cutAt(next) : undefined;
  if (cut) {
    const forward = edge(cut) + cut.offsetWidth - fade;
    const back = Math.max(0, edge(cut) - fade);
    const fits = (at: number) =>
      start >= at && end <= at + lane.clientWidth - (at < most ? fade : 0);
    if (forward <= most && fits(forward)) next = forward;
    else if (fits(back)) next = back;
    else if (fits(forward)) {
      // The last tabs: give the strip just enough room past its end to start on a tab.
      lane.style.paddingInlineEnd = `${Math.ceil(forward - most)}px`;
      padded.set(lane, tab);
      next = forward;
    }
  }
  lane.scrollLeft = next;
};
