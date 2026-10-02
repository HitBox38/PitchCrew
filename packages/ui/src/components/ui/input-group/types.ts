import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  inputGroupAddonVariants,
  inputGroupButtonVariants,
} from '@/components/ui/input-group/constants.ts';
import { type VariantProps } from 'class-variance-authority';
import * as React from 'react';

export type InputGroupProps = React.ComponentProps<'div'>;
export type InputGroupAddonProps = React.ComponentProps<'div'> &
  VariantProps<typeof inputGroupAddonVariants>;
export type InputGroupButtonProps = Omit<React.ComponentProps<typeof Button>, 'size' | 'type'> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: 'button' | 'submit' | 'reset';
  };

export type InputGroupInputProps = React.ComponentProps<'input'>;

export type InputGroupTextProps = React.ComponentProps<'span'>;

export type InputGroupTextareaProps = React.ComponentProps<'textarea'>;
