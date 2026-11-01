import { Button } from '@pitchcrew/design-system/button';
import { ExternalLink } from 'lucide-react';

export const ReleaseLink = ({ url }: { url: string }) => {
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
};
