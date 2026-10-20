import { LoaderCircle } from 'lucide-react';

export const SourceProgress = ({ label }: { label: string }) => {
  return (
    <output className="flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle
        size={16}
        className="shrink-0 animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      {label}
    </output>
  );
};
