import { z } from 'zod';
import { google, googlePage, id, tool } from './helpers.ts';

export const driveTools = {
  google_drive_search_files: tool(
    'drive',
    "Search Drive metadata using Drive query syntax, for example name contains 'resume'. Includes shared drives; returns nextPageToken. Use returned file IDs to read.",
    { query: z.string().max(2000).default(''), ...googlePage },
    (i) =>
      google('/drive/v3/files', {
        q: i.query ? `trashed = false and (${i.query})` : 'trashed = false',
        pageSize: i.limit,
        pageToken: i.pageToken,
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,description,size)',
        includeItemsFromAllDrives: 'true',
        supportsAllDrives: 'true',
      }),
  ),
  google_drive_get_file: tool(
    'drive',
    'Read Drive file metadata. Native Docs can be read with google_docs_get_document; native Sheets with google_sheets_read_range.',
    { fileId: id },
    (i) =>
      google(`/drive/v3/files/${i.fileId}`, {
        fields: 'id,name,mimeType,description,modifiedTime,webViewLink,size',
        supportsAllDrives: 'true',
      }),
  ),
  google_drive_read_text_file: tool(
    'drive',
    'Download a small UTF-8 text, Markdown, CSV or JSON file from Drive. Binary documents and PDFs are not supported. Native Docs use google_docs_get_document.',
    { fileId: id },
    (i) => ({
      ...google(`/drive/v3/files/${i.fileId}`, { alt: 'media', supportsAllDrives: 'true' }),
      text: true,
    }),
  ),
  google_docs_get_document: tool(
    'drive',
    'Read a Google Doc as plain text through Drive export. Does not edit the document. Copy verified facts into your local profile before citing them in packets.',
    { documentId: id },
    (i) => ({
      ...google(`/drive/v3/files/${i.documentId}/export`, { mimeType: 'text/plain' }),
      text: true,
    }),
  ),
};
