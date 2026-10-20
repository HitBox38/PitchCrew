import { format } from 'date-fns';

export const pickerDate = (value: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(`${value.split('T')[0]}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date : undefined;
};
export const pickerValue = (date: Date, time: string): string => {
  return `${format(date, 'yyyy-MM-dd')}T${time.length === 5 ? `${time}:00` : time}`;
};
export const pickerLabel = (value: string): string => {
  const date = pickerDate(value);
  return date ? `${format(date, 'MMM d, yyyy')} · ${value.split('T')[1]}` : 'Choose date and time';
};
