import { Brand } from '@/components/Brand/index.tsx';
import { LoaderCircle } from 'lucide-react';

/** Available before the lazy workspace downloads, including on a cold connection. */
export const WorkspaceLoading = () => (
  <div className="boot">
    <Brand />
    <p>
      <output>Opening your local workspace…</output>
    </p>
    <LoaderCircle className="spin" size={22} aria-hidden="true" />
  </div>
);
