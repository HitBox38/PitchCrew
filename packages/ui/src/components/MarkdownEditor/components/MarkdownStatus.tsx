export const MarkdownStatus = ({ content, status }: { content: string; status: string }) => {
  return (
    <footer className="profile-editor-status">
      <output className="profile-save-state" aria-live="polite">
        {status}
      </output>
      <span className="ml-auto">
        {content.trim() ? content.trim().split(/\s+/u).length : 0} words
      </span>
      <span>Markdown</span>
    </footer>
  );
};
