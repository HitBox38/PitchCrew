export const sidebarMediaFixture = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SidebarProvider, useSidebar } from '@pitchcrew/design-system/sidebar';
import { useShortCoarseChatRail } from '/src/App/hooks/useShortCoarseChatRail.ts';
const h = React.createElement;
const parameters = new URLSearchParams(location.search);
const initial = parameters.get('open') !== 'false';
const controlled = parameters.has('controlled');
const Controls = ({ preferRail }) => {
  const sidebar = useSidebar();
  return h('section', { id: 'state', 'data-open': String(sidebar.open),
    'data-mobile': String(sidebar.isMobile), 'data-drawer': String(sidebar.openMobile),
    'data-rail': String(preferRail) },
    h('button', { onClick: sidebar.toggleSidebar }, 'Toggle navigation'));
};
const Fixture = () => {
  const [view, setView] = useState('chat');
  const [open, setOpen] = useState(initial);
  const preferRail = useShortCoarseChatRail(view);
  return h(React.Fragment, null,
    h('button', { onClick: () => setView('board') }, 'Board'),
    h('button', { onClick: () => setView('chat') }, 'Chat'),
    h('output', { id: 'normal-preference' }, String(open)),
    h(SidebarProvider, { defaultOpen: initial, preferRail,
      open: controlled ? open : undefined,
      onOpenChange: controlled ? setOpen : undefined }, h(Controls, { preferRail })));
};
createRoot(document.getElementById('root')).render(h(Fixture));
`;
