import { Check, FileText, NotebookText, Ruler } from 'lucide-react';
import { Trace, TraceIcon, TraceLine, TraceTitle } from '@pitchcrew/design-system/trace';
import { Pebble } from '../../components/clay/Pebble';
import { RoleIcon } from '../../components/clay/RoleIcon';

const stepsRun = [
  { icon: FileText, label: 'Read the confirmed job brief' },
  { icon: NotebookText, label: 'Read your profile notes' },
  { icon: Ruler, label: 'Read your packet rules' },
  { icon: Check, label: 'Checked the packet: 4 claims, all quoted' },
];

/** One Writer turn, with the recessed thread the app draws between request and reply. */
export const ChatTurn = () => {
  return (
    <div className="chat-turn" data-ui="" aria-label="A fictional chat turn with Writer">
      <p className="chat-user">
        Tailor my resume for Forma. Quote only my notes and flag anything you can’t support.
      </p>
      <div className="chat-thread">
        <p className="chat-runtime">
          <Pebble agent="writer" size={24}>
            <RoleIcon agent="writer" size={13} />
          </Pebble>
          Writer · Claude Code · Sonnet · 41s
        </p>
        <Trace className="chat-steps">
          {stepsRun.map(({ icon: Icon, label }) => (
            <TraceLine key={label} className="chat-step">
              <TraceIcon>
                <Icon />
              </TraceIcon>
              <TraceTitle>{label}</TraceTitle>
            </TraceLine>
          ))}
        </Trace>
        <p className="chat-progress">
          One gap: the posting asks for design-system ownership and your notes don’t mention it, so
          I left it out.
        </p>
      </div>
      <div className="chat-reply">
        <p>Your draft is ready for Reviewer: four claims, each quoted from experience.md.</p>
        <p>If you have owned a design system, add it to your profile and I’ll use your words.</p>
      </div>
    </div>
  );
};
