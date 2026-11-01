import { createRoot } from 'react-dom/client';
import '@pitchcrew/design-system/styles.css';
import { Button } from '@pitchcrew/design-system/button';
import { Input } from '@pitchcrew/design-system/input';
import { Calendar } from '@pitchcrew/design-system/calendar';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@pitchcrew/design-system/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@pitchcrew/design-system/select';

const SharedComponents = () => (
  <main className="mx-auto max-w-lg space-y-6 p-6">
    <Button className="h-12">Shared action</Button>
    <Input aria-label="Name" />
    <Calendar defaultMonth={new Date(2026, 10)} />
    <Select
      defaultValue="remote"
      items={[
        { value: 'remote', label: 'Remote' },
        { value: 'hybrid', label: 'Hybrid' },
      ]}
    >
      <SelectTrigger aria-label="Work mode">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="remote">Remote</SelectItem>
        <SelectItem value="hybrid">Hybrid</SelectItem>
      </SelectContent>
    </Select>
    <Dialog>
      <DialogTrigger render={<Button variant="secondary" />}>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogTitle>Shared dialog</DialogTitle>
        <DialogDescription>Works without an app provider.</DialogDescription>
        <DialogClose render={<Button />}>Done</DialogClose>
      </DialogContent>
    </Dialog>
  </main>
);

createRoot(document.getElementById('root')!).render(<SharedComponents />);
