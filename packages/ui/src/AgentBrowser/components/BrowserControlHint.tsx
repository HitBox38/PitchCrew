/** Shown while an agent run uses the page; a press on the page flashes it as a nudge. */
export const BrowserControlHint = ({ name, nudged }: { name?: string; nudged: boolean }) => (
  <output className="browser-control-hint" data-nudged={nudged || undefined}>
    {name ?? 'Your agent'} is using this page. Take control to use it yourself; it pauses until you
    return it.
  </output>
);
