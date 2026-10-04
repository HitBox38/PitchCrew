import type { ApplicationImportReport } from '@pitchcrew/core';
import { describe, expect, it } from 'vitest';
import { importCounts, importFormat, importPath, readImportFile } from '../helpers.ts';

describe('application import helpers', () => {
  it('detects the file format from its extension', () => {
    expect(importFormat('past.JSON')).toBe('json');
    expect(importFormat('tracker.export.csv')).toBe('csv');
    expect(importFormat('tracker.db')).toBeNull();
  });
  it('reads supported files and rejects other formats or oversized files', async () => {
    const file = new File(['company,state\nFictional Labs,lead\n'], 'past.csv');
    await expect(readImportFile(file)).resolves.toMatchObject({ format: 'csv', name: 'past.csv' });
    await expect(readImportFile(new File(['x'], 'tracker.db'))).rejects.toThrow('.json or .csv');
    const large = new File(['x'.repeat(2 * 1024 * 1024 + 1)], 'large.json');
    await expect(readImportFile(large)).rejects.toThrow('2 MB');
  });
  it('summarizes counts and planned status paths in plain words', () => {
    const report = {
      digest: '0'.repeat(64),
      rows: [],
      counts: { new: 3, created: 0, imported: 1, duplicate: 2, invalid: 0, failed: 0 },
    } satisfies ApplicationImportReport;
    expect(importCounts(report)).toBe('3 new · 1 already imported · 2 duplicate');
    expect(importPath(['submitted', 'interviewing', 'offer'])).toBe(
      'Submitted → Interviewing → Offer',
    );
  });
});
