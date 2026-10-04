import { describe, expect, it } from 'vitest';
import { pickerDate, pickerLabel, pickerValue } from '../helpers.ts';
import { instantTime } from '../../RoutinesPage/helpers.ts';

describe('date and time picker wall-clock values', () => {
  it('keeps the calendar day and seconds for conversion in the chosen timezone', () => {
    const date = pickerDate('2026-10-15T14:30:45')!;
    const local = pickerValue(date, '14:30:45');
    expect(local).toBe('2026-10-15T14:30:45');
    expect(instantTime(local, 'Asia/Jerusalem')).toBe('2026-10-15T11:30:45.000Z');
    expect(instantTime(local, 'America/New_York')).toBe('2026-10-15T18:30:45.000Z');
  });
  it('normalizes minute-only time input and handles an unset optional date', () => {
    expect(pickerValue(pickerDate('2026-01-02T23:59:59')!, '09:15')).toBe('2026-01-02T09:15:00');
    expect(pickerDate('')).toBeUndefined();
    expect(pickerDate('invalid')).toBeUndefined();
    expect(pickerLabel('')).toBe('Choose date and time');
  });
});
