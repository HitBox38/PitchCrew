/**
 * A filename that truncates in the middle of its stem so the extension stays visible
 * ("cover_letter_for_jun….pdf"). Assistive technology reads the exact name as one text node;
 * the split spans are only its picture, since flex items would read as separate words.
 */
export const FileName = ({ name }: { name: string }) => {
  const dot = name.lastIndexOf('.');
  const extension = dot > 0 ? name.slice(dot) : '';
  return (
    <span className="file-name" title={name}>
      <span className="sr-only">{name}</span>
      <span className="file-name-stem" aria-hidden="true">
        {extension ? name.slice(0, dot) : name}
      </span>
      {extension ? (
        <span className="file-name-extension" aria-hidden="true">
          {extension}
        </span>
      ) : null}
    </span>
  );
};
