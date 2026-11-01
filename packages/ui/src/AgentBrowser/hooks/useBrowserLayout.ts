import { shownPanelView } from '../layout.ts';
import type { AgentBrowserProps } from '../types.ts';
import type { useBrowserPresentation } from './useBrowserPresentation.ts';

/** Panel layout: whether the panel offers Packet | Browser, and which one is shown. */
export const useBrowserLayout = (
  {
    browserPanel,
    data,
    conversation,
  }: Pick<AgentBrowserProps, 'browserPanel' | 'data' | 'conversation'>,
  { expanded, narrow, setExpanded }: ReturnType<typeof useBrowserPresentation>,
) => {
  const card = data.cards.find((item) => item.id === conversation?.cardId);
  const packet = card?.packet ? { card, packet: card.packet } : null;
  const view = shownPanelView({ view: browserPanel.view, packet: !!packet, expanded });
  return {
    packet,
    view,
    switchable: !!packet && !expanded,
    sideColumn: expanded && !narrow,
    modal: narrow || expanded,
    toggleExpanded: () => setExpanded(!expanded),
    /** Dismissing the expanded view (Escape) returns to the split chat view; dialogs, menus and
     * fields inside the panel handle their own Escape first. On narrow screens it hides. */
    dismiss: expanded && !narrow ? () => setExpanded(false) : browserPanel.hide,
  };
};
