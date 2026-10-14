import { Streamdown } from 'streamdown';

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
    <Streamdown mode="static" controls={false} components={components}>
      {content}
    </Streamdown>
  ) : (
    <p className="quiet">{empty}</p>
  );
}
