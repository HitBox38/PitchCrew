import { SourceBlock } from '@/components/SourceBlock/index.tsx';

export const ServiceCommand = ({ command }: { command: string }) => {
  return <SourceBlock label="Background service command" value={command} />;
};
