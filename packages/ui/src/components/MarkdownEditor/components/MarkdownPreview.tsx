import { MarkdownContent } from '@/components/MarkdownContent/index.tsx';

const components = {
  img: ({ alt }: { alt?: string }) => <span className="quiet">[Image: {alt || 'image'}]</span>,
};

export default function MarkdownPreview({
  content,
  empty = 'Write a note to see its preview.',
}: {
  content: string;
  empty?: string;
}) {
  return content.trim() ? (
    <MarkdownContent controls={false} components={components}>
      {content}
    </MarkdownContent>
  ) : (
    <p className="quiet">{empty}</p>
  );
}
