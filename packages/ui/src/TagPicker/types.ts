export interface TagPickerProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
  disabled?: boolean;
}
