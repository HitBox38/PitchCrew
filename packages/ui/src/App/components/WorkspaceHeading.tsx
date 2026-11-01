import type { WorkspaceHeadingProps } from '@/App/types.ts';
import type { Ref } from 'react';

type Slots = {
  factRef: Ref<HTMLSpanElement>;
  segmentRef: Ref<HTMLDivElement>;
  actionsRef: Ref<HTMLDivElement>;
  primaryRef: Ref<HTMLDivElement>;
};

/**
 * The open title row every shared page gets: title, one fact, an optional segment, then the
 * page's own search and actions and its one primary on the right. No icon, subtitle or card.
 */
export const WorkspaceHeading = ({
  title,
  fact,
  factRef,
  segmentRef,
  actionsRef,
  primaryRef,
}: WorkspaceHeadingProps & Slots) => (
  <header className="ui-title-row workspace-title-row">
    <h1 className="ui-title">{title}</h1>
    <span className="ui-title-fact workspace-title-fact" ref={factRef}>
      {fact ? <span className="workspace-default-fact">{fact}</span> : null}
    </span>
    <div className="workspace-title-segment" ref={segmentRef} />
    <div className="ui-title-actions workspace-title-actions" ref={actionsRef} />
    <div className="workspace-title-primary" ref={primaryRef} />
  </header>
);
