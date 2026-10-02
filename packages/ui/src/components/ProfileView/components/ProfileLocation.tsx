import type { ProfileLocationProps } from '@/components/ProfileView/types.ts';
import { FolderOpen } from 'lucide-react';

export function ProfileLocation({ data }: ProfileLocationProps) {
  return (
    <div className="data-location">
      <FolderOpen size={17} />
      <span>
        Stored in{' '}
        <code>
          {data.dataDirectory}
          {data.dataDirectory.includes('\\') ? '\\' : '/'}profile
        </code>
      </span>
    </div>
  );
}
