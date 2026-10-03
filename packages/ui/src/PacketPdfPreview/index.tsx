import { usePacketPdfPreview } from './hooks/usePacketPdfPreview.ts';

export default function PacketPdfPreview({ bytes, name }: { bytes: string; name: string }) {
  const { pages, error } = usePacketPdfPreview(bytes);
  if (error)
    return (
      <p className="form-error" role="alert">
        PDF preview: {error}
      </p>
    );
  if (!pages.length) return <output className="quiet">Rendering document pages...</output>;
  return (
    <div className="max-h-160 space-y-3 overflow-y-auto rounded border p-2">
      {pages.map((page, index) => (
        <figure key={index}>
          <img
            src={page}
            alt={`${name}, page ${index + 1} of ${pages.length}`}
            className="h-auto w-full bg-white"
          />
          <figcaption className="quiet text-center">
            Page {index + 1} of {pages.length}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
