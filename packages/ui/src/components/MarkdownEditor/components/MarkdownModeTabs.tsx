import { TabsList, TabsTrigger } from '@/components/ui/tabs/index.tsx';
import { Eye, PencilLine } from 'lucide-react';

export const MarkdownModeTabs = ({ label }: { label: string }) => {
  return (
    <TabsList aria-label={label} className="profile-mode-tabs">
      <TabsTrigger value="write">
        <PencilLine size={14} /> Write
      </TabsTrigger>
      <TabsTrigger value="preview">
        <Eye size={14} /> Preview
      </TabsTrigger>
    </TabsList>
  );
};
