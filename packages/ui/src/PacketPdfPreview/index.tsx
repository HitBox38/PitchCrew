import { usePacketPdfPreview } from './hooks/usePacketPdfPreview.ts';

const PacketPdfPreview = ({ bytes, name }: { bytes: string; name: string }) => {
  const { pages, error } = usePacketPdfPreview(bytes);
  if (error)
    return (
      <p className="form-error" role="alert">
        PDF preview: {error}
      </p>
    );
  if (!pages.length) return <output className="quiet">Rendering document pages...</output>;
  return (
    <div className="packet-pdf-preview max-h-160 space-y-3 overflow-y-auto rounded-xl p-3">
      {pages.map((page, index) => (
        // react-doctor-disable-next-line react-doctor/no-array-index-as-key -- Pages are a fixed ordered snapshot; their page number is their identity.
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
};
export default PacketPdfPreview;
