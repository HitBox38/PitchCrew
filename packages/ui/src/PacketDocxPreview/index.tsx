import { usePacketDocxPreview } from './hooks/usePacketDocxPreview.ts';

export default function PacketDocxPreview({ bytes, name }: { bytes: string; name: string }) {
  const { document, error } = usePacketDocxPreview(bytes);
  if (error)
    return (
      <p className="form-error" role="alert">
        DOCX preview: {error}
      </p>
    );
  if (!document) return <output className="quiet">Rendering DOCX preview...</output>;
  return (
    <div className="space-y-2">
      <p className="quiet">DOCX layout may differ from Word. Complete document text is below.</p>
      <iframe
        title={`${name} DOCX preview`}
        srcDoc={document}
        sandbox=""
        referrerPolicy="no-referrer"
        className="h-160 w-full rounded border bg-white"
      />
    </div>
  );
}
