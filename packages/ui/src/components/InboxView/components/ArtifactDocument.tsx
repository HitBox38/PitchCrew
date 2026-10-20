import { AccordionSection } from '@/components/ui/accordion/components/AccordionSection.tsx';
import { SourceBlock } from '@/components/SourceBlock/index.tsx';
import { lazy, Suspense, useState } from 'react';
import type { Approval, PacketArtifact } from '@pitchcrew/core';
import { useArtifactUrl } from '../hooks/useArtifactUrl.ts';
import { type ArtifactPages, pageLabel } from '../helpers.ts';

export const ArtifactDocument = ({
  approval,
  artifact,
  pages,
}: {
  approval: Approval;
  artifact: PacketArtifact;
  pages: ArtifactPages;
}) => {
  const { url, setOpened } = useArtifactUrl(artifact);
  const count = pageLabel(artifact, pages);
  const [opened, setPreviewOpened] = useState(false);
  return (
    <AccordionSection
      className="approval-preview"
      onOpenChange={(open) => {
        setOpened(open);
        setPreviewOpened(open);
      }}
      heading={
        <>
          {artifact.name} · {count ? `${count} · ` : ''}
          {(
            (artifact.bytes.length * 3) / 4 -
            (artifact.bytes.endsWith('==') ? 2 : artifact.bytes.endsWith('=') ? 1 : 0)
          ).toLocaleString()}{' '}
          bytes
        </>
      }
    >
      <p className="quiet break-all">SHA-256: {artifact.digest}</p>
      <p className="quiet">{artifact.mimeType}</p>
      {artifact.mimeType === 'application/pdf' && opened ? (
        <Suspense fallback={<p className="quiet">Loading PDF preview...</p>}>
          <PacketPdfPreview bytes={artifact.bytes} name={artifact.name} />
        </Suspense>
      ) : null}
      {artifact.mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' && opened ? (
        <Suspense fallback={<p className="quiet">Loading DOCX preview...</p>}>
          <PacketDocxPreview bytes={artifact.bytes} name={artifact.name} />
        </Suspense>
      ) : null}
      <AccordionSection heading="Complete document text">
        <SourceBlock
          label={artifact.name}
          value={approval.packet[artifact.source]}
          contentClassName="font-sans"
        />
      </AccordionSection>
      {approval.status === 'consumed' && approval.exportDirectory && url ? (
        <a className="text-button" href={url} download={artifact.name}>
          Download exported {artifact.name}
        </a>
      ) : null}
    </AccordionSection>
  );
};

const PacketPdfPreview = lazy(() => import('@/PacketPdfPreview/index.tsx'));
const PacketDocxPreview = lazy(() => import('@/PacketDocxPreview/index.tsx'));
