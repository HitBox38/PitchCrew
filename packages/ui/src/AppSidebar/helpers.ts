import { themeOptions } from '@/AppSidebar/constants.ts';
import type { AppSidebarProps } from '@/AppSidebar/types.ts';

export function getSidebarModel(props: AppSidebarProps) {
  const { theme } = props;
  const ThemeIcon = themeOptions.find((option) => option.id === theme)!.icon;
  return { ...props, ThemeIcon };
}
