import { gateLines } from '../../constants.ts';
import type { BodyProps } from '../../types.ts';
import { bodies } from './bodies.ts';

/**
 * The open row, in reading order: the exact ask, its evidence, who asked and when, what stays
 * stuck while it waits, the kind's own verbs with the glazed one first, then what deciding does
 * and does not do. Kinds whose embedded footer states its consequence keep that line, and a
 * question sets its own above its link to the conversation; the others get theirs here. The body
 * is a `decide` container, so embedded decision footers reflow as they do on Decisions.
 */
export const NeedsBody = (props: BodyProps) => {
  const Body = bodies[props.item.kind];
  const gate = gateLines[props.item.kind];
  return (
    <div className="needs-open-body" data-kind={props.item.kind}>
      <Body {...props} />
      {gate ? <p className="needs-gate">{gate}</p> : null}
    </div>
  );
};
