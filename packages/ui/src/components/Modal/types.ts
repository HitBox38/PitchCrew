import { type ReactNode } from 'react';
import type { DialogContentProps } from '@/components/ui/dialog/types.ts';

export interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
  className?: string;
  initialFocus?: DialogContentProps['initialFocus'];
  finalFocus?: DialogContentProps['finalFocus'];
}
