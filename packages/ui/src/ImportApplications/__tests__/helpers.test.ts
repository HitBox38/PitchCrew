import type { ApplicationImportReport } from '@pitchcrew/core';
import { describe, expect, it, vi } from 'vitest';
import {
  importCounts,
  importFormat,
  importPath,
  importReason,
  importStatusChange,
  readImportFile,
} from '../helpers.ts';

describe('application import helpers', () => {
  it('detects the file format from its extension', () => {
    expect(importFormat('past.JSON')).toBe('json');
    expect(importFormat('tracker.export.csv')).toBe('csv');
    expect(importFormat('tracker.db')).toBe('sqlite');
    expect(importFormat('tracker.SQLITE3')).toBe('sqlite');
    expect(importFormat('tracker.sqlite')).toBe('sqlite');
    expect(importFormat('tracker.pdf')).toBeNull();
  });
  it('reads supported files and rejects other formats or oversized files', async () => {
    const file = new File(['company,state\nFictional Labs,lead\n'], 'past.csv');
    const convert = vi.fn();
    await expect(readImportFile(file, convert)).resolves.toMatchObject({
      format: 'csv',
      name: 'past.csv',
    });
    await expect(readImportFile(new File(['x'], 'tracker.pdf'), convert)).rejects.toThrow(
      'Choose a',
    );
    const large = new File(['x'.repeat(2 * 1024 * 1024 + 1)], 'large.json');
    await expect(readImportFile(large, convert)).rejects.toThrow('2 MB');
    await expect(readImportFile(new File([large], 'large.db'), convert)).rejects.toThrow('2 MB');
    expect(convert).not.toHaveBeenCalled();
  });
  it('converts binary SQLite uploads to the exact JSON used by preview and confirmation', async () => {
    const bytes = new Uint8Array([0, 128, 255, 10]);
    const converted = {
      content: '[{"company":"Fictional Labs","state":"lead"}]',
      warnings: ['Dates assumed UTC.'],
    };
    const convert = vi.fn().mockResolvedValue(converted);
    const upload = await readImportFile(new File([bytes], 'applications.db'), convert);
    expect(convert).toHaveBeenCalledWith('AID/Cg==');
    expect(upload).toEqual({
      name: 'applications.db',
      format: 'json',
      sourceFormat: 'sqlite',
      ...converted,
    });
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

describe('import row wording', () => {
  it('turns validator issues into field sentences and keeps the raw text as detail', () => {
    const reason = 'company: Invalid input: expected string, received undefined';
    expect(importReason({ row: 3, status: 'invalid', reason })).toEqual({
      text: 'Company is missing — row 3 was skipped.',
      detail: reason,
    });
    expect(
      importReason({
        row: 4,
        status: 'invalid',
        reason:
          'state: Invalid option: expected one of "lead"|"submitted"; url: Use an HTTP or HTTPS URL.',
      }).text,
    ).toBe(
      "Status isn't one Pitchcrew recognizes; Posting link: Use an HTTP or HTTPS URL — row 4 was skipped.",
    );
    expect(importReason({ row: 1, status: 'duplicate', reason: 'Matches a job.' })).toEqual({
      text: 'Matches a job.',
      detail: null,
    });
  });
  it('names the source status beside the imported one only when they differ', () => {
    expect(importStatusChange({ sourceState: 'interviewing', state: 'interviewing' })).toBe(
      'Interviewing',
    );
    expect(importStatusChange({ sourceState: 'applied', state: 'submitted' })).toBe(
      'applied → Submitted',
    );
    expect(importStatusChange({ sourceState: 'submitted', state: null })).toBe(
      'submitted · not imported',
    );
  });
});
