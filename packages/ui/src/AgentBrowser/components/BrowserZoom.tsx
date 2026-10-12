import { ChevronDown, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu/index.tsx';
const levels = [
  { value: '1', label: 'Fit to panel' },
  { value: '1.5', label: '150%' },
  { value: '2', label: '200%' },
  { value: '3.5', label: '350%' },
];
export function BrowserZoom({
  zoom,
  setZoom,
  panView,
  setPanView,
}: {
  zoom: number;
  setZoom: (zoom: number) => void;
  panView: boolean;
  setPanView: (pan: boolean) => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="ghost"
            className="browser-view-menu"
            aria-label="Page view settings"
            title={panView ? 'Panning the enlarged view' : 'Page zoom and panning'}
          />
        }
      >
        {panView ? <Hand size={12} /> : null}
        {zoom === 1 ? 'Fit' : `${zoom * 100}%`}
        <ChevronDown size={12} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Page view</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuRadioGroup
          value={String(zoom)}
          onValueChange={(value) => setZoom(Number(value))}
        >
          {levels.map((level) => (
            <DropdownMenuRadioItem key={level.value} value={level.value} closeOnClick>
              {level.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={panView}
          disabled={zoom === 1}
          onCheckedChange={setPanView}
        >
          Pan enlarged view
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
