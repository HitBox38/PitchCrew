export interface DateTimePickerProps {
  label: string;
  value: string;
  onValueChange(value: string): void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
}
