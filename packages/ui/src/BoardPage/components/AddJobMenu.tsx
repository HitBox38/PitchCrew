import { ChevronDown, Plus, Upload } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pitchcrew/design-system/dropdown-menu';

/** The Board's one glaze action, with importing past applications under its caret. */
export const AddJobMenu = ({
  add,
  importApplications,
}: {
  add: () => void;
  importApplications: () => void;
}) => (
  <div className="board-add-split">
    <Button size="sm" className="board-add-job" onClick={add}>
      <Plus size={15} aria-hidden="true" /> Add job
    </Button>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={<Button size="icon-sm" className="board-add-more" aria-label="More ways to add" />}
      >
        <ChevronDown size={15} aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem onClick={importApplications}>
          <Upload size={15} aria-hidden="true" /> Import applications…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
