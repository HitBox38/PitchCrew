import type { ConnectorRequest } from '../tools/helpers.ts';

// Only these existing read-only connector tools can reach the native CLI.
const methods: Record<string, readonly string[]> = {
  gmail_search_messages: ['gmail', 'users', 'messages', 'list'],
  gmail_get_message: ['gmail', 'users', 'messages', 'get'],
  gmail_get_thread: ['gmail', 'users', 'threads', 'get'],
  google_drive_search_files: ['drive', 'files', 'list'],
  google_drive_get_file: ['drive', 'files', 'get'],
  google_drive_read_text_file: ['drive', 'files', 'get'],
  google_docs_get_document: ['drive', 'files', 'export'],
  google_sheets_read_range: ['sheets', 'spreadsheets', 'values', 'get'],
  google_calendar_list_events: ['calendar', 'events', 'list'],
};
export function googleCliArgs(name: string, request: ConnectorRequest) {
  const method = methods[name];
  if (!method) throw new Error('Unsupported Google Workspace CLI read.');
  const { url } = request;
  if (
    !['https://www.googleapis.com', 'https://sheets.googleapis.com'].includes(url.origin) ||
    url.username ||
    url.password
  )
    throw new Error('Unsupported Google Workspace CLI URL.');
  const path = url.pathname.split('/').map(decodeURIComponent);
  const params: Record<string, string | number | boolean> = {};
  for (const [key, value] of url.searchParams) {
    params[key] = ['maxResults', 'pageSize'].includes(key)
      ? Number(value)
      : ['singleEvents', 'supportsAllDrives', 'includeItemsFromAllDrives'].includes(key)
        ? value === 'true'
        : value;
  }
  switch (method[0]) {
    case 'gmail':
      params.userId = 'me';
      if (method.at(-1) === 'get') params.id = path[6]!;
      break;
    case 'drive':
      if (method.at(-1) !== 'list') params.fileId = path[4]!;
      break;
    case 'sheets':
      params.spreadsheetId = path[3]!;
      params.range = path[5]!;
      break;
    case 'calendar':
      params.calendarId = path[4]!;
      break;
  }
  return [...method, '--params', JSON.stringify(params)];
}
