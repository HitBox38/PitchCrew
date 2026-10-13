import { Streamdown } from 'streamdown';

const components = {
  img: ({ alt }: { alt?: string }) => <span className="quiet">[Image: {alt || 'image'}]</span>,
};

export default function ProfilePreview({ content }: { content: string }) {
  return content.trim() ? (
    <Streamdown mode="static" controls={false} components={components}>
      {content}
    </Streamdown>
  ) : (
    <p className="quiet">Write a note to see its preview.</p>
  );
}
