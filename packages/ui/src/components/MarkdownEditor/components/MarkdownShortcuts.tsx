import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@pitchcrew/design-system/dialog';
import { Kbd } from '@pitchcrew/design-system/kbd';
import { editorKeys, shortcutLabel } from '../shortcuts.ts';

/** A chord, or two pressed one after the other ("Esc, then Tab"). */
type Keys = readonly string[] | readonly [readonly string[], readonly string[]];
const groups: [string, [string, Keys][]][] = [
  [
    'Formatting',
    [
      ['Bold', editorKeys.bold],
      ['Italic', editorKeys.italic],
      ['Strikethrough', editorKeys.strike],
      ['Inline code', editorKeys.code],
      ['Link the selection', editorKeys.link],
      ['Text, Heading 1–3', ['Mod', 'Alt', '0–3']],
    ],
  ],
  [
    'Blocks',
    [
      ['Block menu', ['/']],
      ['Numbered list', editorKeys.number],
      ['Bulleted list', editorKeys.bullet],
      ['Checklist', ['Mod', 'Shift', '9']],
      ['Check or uncheck a task', editorKeys.task],
      ['Next table cell', ['Tab']],
    ],
  ],
  [
    'Editing',
    [
      ['Find and replace', editorKeys.find],
      ['Save', editorKeys.save],
      ['Continue a list', ['Enter']],
      ['Indent a list item', ['Tab']],
      ['Leave the editor', [['Esc'], ['Tab']]],
      ['Show or hide the sidebar', ['Mod', '\\']],
    ],
  ],
];

/** Every editor shortcut in one place, grouped, for people who never read tooltips. */
export const MarkdownShortcuts = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="modal md-shortcuts">
      <DialogHeader>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>Notes are Markdown. These work while you write.</DialogDescription>
      </DialogHeader>
      <div>
        {groups.map(([group, rows]) => (
          <section key={group} aria-label={group}>
            <h3 className="md-shortcut-group">{group}</h3>
            <dl className="md-shortcut-list">
              {rows.map(([label, keys]) => (
                <div key={label} className="md-shortcut-row">
                  <dt>{label}</dt>
                  <dd>
                    {typeof keys[0] === 'string' ? (
                      <Kbd>{shortcutLabel(keys as readonly string[])}</Kbd>
                    ) : (
                      <>
                        <Kbd>{shortcutLabel(keys[0])}</Kbd> then{' '}
                        <Kbd>{shortcutLabel(keys[1] as readonly string[])}</Kbd>
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </DialogContent>
  </Dialog>
);
