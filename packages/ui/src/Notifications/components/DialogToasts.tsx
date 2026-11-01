import { useDialogToasts } from '../hooks/useDialogToasts.ts';

/** Moves the toast stack off open dialogs; renders nothing. Lives inside the toast provider. */
export const DialogToasts = () => {
  useDialogToasts();
  return null;
};
