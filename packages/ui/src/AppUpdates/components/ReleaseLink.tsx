import { Button } from '@/components/ui/button/components/Button.tsx';
import { ExternalLink } from 'lucide-react';

export function ReleaseLink({ url }: { url: string }) {
  return (
    <Button
      className="button"
      nativeButton={false}
      render={
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View release and download"
        />
      }
    >
      <ExternalLink size={15} aria-hidden="true" /> View release & download
    </Button>
  );
}
