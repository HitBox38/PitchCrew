import { buttonVariants } from '@/components/ui/button/constants.ts';
import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { type VariantProps } from 'class-variance-authority';

export type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>;
