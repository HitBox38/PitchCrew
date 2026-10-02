import { z } from 'zod';
import { id, request, tool } from './helpers.ts';

export const sheetsTools = {
  google_sheets_read_range: tool(
    'sheets',
    'Read a bounded A1 cell range from Google Sheets, for example Jobs!A1:F50. Does not edit the spreadsheet.',
    {
      spreadsheetId: id,
      range: z
        .string()
        .min(1)
        .max(200)
        .refine(
          (v) => /!?\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+$/i.test(v),
          'Use a bounded A1 range, for example Jobs!A1:F50.',
        ),
    },
    (i) =>
      request(
        'https://sheets.googleapis.com',
        `/v4/spreadsheets/${i.spreadsheetId}/values/${encodeURIComponent(i.range)}`,
      ),
  ),
};
