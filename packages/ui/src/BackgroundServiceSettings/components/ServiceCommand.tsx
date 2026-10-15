import { SourceBlock } from '@/components/SourceBlock/index.tsx';

export function ServiceCommand({ command }: { command: string }) {
  return <SourceBlock label="Background service command" value={command} />;
}
