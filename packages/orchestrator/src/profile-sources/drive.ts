import type { ProfileSourceInput } from '@pitchcrew/core';
import type { ConnectorManager } from '@pitchcrew/mcp/connectors';
import { MAX_FILES, MAX_FOLDERS, object, text, type RemoteFile } from './helpers.ts';

const folderType = 'application/vnd.google-apps.folder';
export async function readDriveSource(
  manager: ConnectorManager,
  input: Extract<ProfileSourceInput, { provider: 'drive' }>,
  signal: AbortSignal,
): Promise<{ label: string; files: RemoteFile[] }> {
  const root = object(
    (await manager.call('google_drive_get_file', { fileId: input.folderId }, signal)).data,
  );
  if (root.mimeType !== folderType) throw new Error('Choose a Google Drive folder.');
  const label = text(root.name);
  const queue = [{ id: input.folderId, path: label }];
  const seen = new Set<string>();
  const files: RemoteFile[] = [];
  let entries = 0;
  while (queue.length) {
    const folder = queue.shift()!;
    if (seen.has(folder.id)) continue;
    seen.add(folder.id);
    if (seen.size > MAX_FOLDERS)
      throw new Error('Too many folders. Choose a smaller source folder.');
    let pageToken: string | undefined;
    const pages = new Set<string>();
    do {
      const listing = object(
        (
          await manager.call(
            'google_drive_search_files',
            {
              query: `'${folder.id}' in parents`,
              limit: 50,
              pageToken,
            },
            signal,
          )
        ).data,
      );
      if (!Array.isArray(listing.files)) throw new Error('Invalid Drive folder response.');
      for (const raw of listing.files) {
        if (++entries > 500) throw new Error('Too many files. Choose a smaller source folder.');
        const file = object(raw);
        const id = text(file.id);
        const path = `${folder.path}/${text(file.name)}`;
        if (file.mimeType === folderType) queue.push({ id, path });
        else if (
          file.mimeType === 'application/vnd.google-apps.document' ||
          (typeof file.mimeType === 'string' &&
            /^(text\/plain|text\/markdown|text\/x-markdown)$/.test(file.mimeType))
        ) {
          if (files.length >= MAX_FILES)
            throw new Error('Too many documents. Choose a smaller source folder.');
          if (file.size && Number(file.size) > 200000)
            throw new Error(`${path} is too large. Choose a smaller source folder.`);
          const doc = file.mimeType === 'application/vnd.google-apps.document';
          const result = object(
            (
              await manager.call(
                doc ? 'google_docs_get_document' : 'google_drive_read_text_file',
                doc ? { documentId: id } : { fileId: id },
                signal,
              )
            ).data,
          );
          const latest = object(
            (await manager.call('google_drive_get_file', { fileId: id }, signal)).data,
          );
          if (latest.modifiedTime !== file.modifiedTime)
            throw new Error(`${path} changed while reading. Load the source again.`);
          files.push({
            key: id,
            path,
            content: text(result.text),
            revision: text(file.modifiedTime),
            url: doc
              ? `https://docs.google.com/document/d/${id}/edit`
              : `https://drive.google.com/file/d/${id}/view`,
          });
        }
      }
      pageToken = typeof listing.nextPageToken === 'string' ? listing.nextPageToken : undefined;
      if (pageToken && pages.has(pageToken))
        throw new Error('Drive returned a repeated page. Retry the source.');
      if (pageToken) pages.add(pageToken);
    } while (pageToken);
  }
  return { label, files };
}
