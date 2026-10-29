import { useState } from 'react';
import { Globe, LoaderCircle } from 'lucide-react';

export const BrowserTabIcon = ({ loading, favicon }: { loading: boolean; favicon?: string }) => {
  const [failed, setFailed] = useState<string>();
  if (loading) return <LoaderCircle className="browser-spinner" size={14} aria-hidden="true" />;
  if (
    favicon &&
    favicon !== failed &&
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
        onError={() => setFailed(favicon)}
      />
    );
  return <Globe size={14} aria-hidden="true" />;
};
