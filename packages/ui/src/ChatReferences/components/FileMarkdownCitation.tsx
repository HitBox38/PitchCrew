import { FileCitation } from './FileCitation.tsx';
export const FileMarkdownCitation = ({ url, label }: { url?: string; label?: string }) =>
  url ? <FileCitation key={url} url={url} label={label ?? 'File'} /> : <span>{label}</span>;
