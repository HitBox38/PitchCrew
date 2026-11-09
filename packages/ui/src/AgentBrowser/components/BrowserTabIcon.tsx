import { useState } from 'react';
import { Globe, LoaderCircle, TriangleAlert } from 'lucide-react';

export const BrowserTabIcon = ({
  loading,
  favicon,
  failed = false,
}: {
  loading: boolean;
  favicon?: string;
  /** The tab's page failed to load; shown in place of its icon. */
  failed?: boolean;
}) => {
  const [broken, setBroken] = useState<string>();
  if (loading) return <LoaderCircle className="browser-spinner" size={14} aria-hidden="true" />;
  if (failed)
    return (
      <TriangleAlert className="browser-tab-failed" size={14} aria-label="Page failed to load" />
    );
  if (
    favicon &&
    favicon !== broken &&
    favicon.length <= 100_000 &&
    /^data:image\/(png|jpeg|webp|gif|ico|x-icon|vnd\.microsoft\.icon);base64,/i.test(favicon)
  )
    return (
      <img
        className="browser-tab-favicon"
        src={favicon}
        alt=""
        aria-hidden="true"
        draggable={false}
        onError={() => setBroken(favicon)}
      />
    );
  return <Globe size={14} aria-hidden="true" />;
};
