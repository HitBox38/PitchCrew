import type { ProfileLocationProps } from '@/components/ProfileView/types.ts';
import { FolderOpen } from 'lucide-react';

export const ProfileLocation = ({ data }: ProfileLocationProps) => {
  return (
    <footer className="data-location">
      <FolderOpen size={17} />
      <span>
        Local notes{' '}
        <code>
          {data.dataDirectory}
          {data.dataDirectory.includes('\\') ? '\\' : '/'}profile
        </code>
      </span>
    </footer>
  );
};
