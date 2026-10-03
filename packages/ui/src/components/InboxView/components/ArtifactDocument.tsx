import type { Approval, PacketArtifact } from '@pitchcrew/core';
import { useArtifactUrl } from '../hooks/useArtifactUrl.ts';

export function ArtifactDocument({
  approval,
  artifact,
}: {
  approval: Approval;
  artifact: PacketArtifact;
}) {
  const { url, setOpened } = useArtifactUrl(artifact);
  return (
    <details className="approval-preview" onToggle={(event) => setOpened(event.currentTarget.open)}>
      <summary>
        {artifact.name} · {Math.floor((artifact.bytes.length * 3) / 4).toLocaleString()} bytes
      </summary>
      <p className="quiet break-all">SHA-256: {artifact.digest}</p>
      <p className="quiet">{artifact.mimeType}</p>
      {artifact.mimeType === 'application/pdf' && url ? (
        <iframe
          src={`${url}#toolbar=0`}
          title={`Generated ${artifact.name}`}
          className="h-96 w-full rounded border"
        />
      ) : (
        <pre>{approval.packet[artifact.source]}</pre>
      )}
      {approval.status === 'consumed' && approval.exportDirectory && url ? (
        <a className="text-button" href={url} download={artifact.name}>
          Download exported {artifact.name}
        </a>
      ) : null}
    </details>
  );
}
