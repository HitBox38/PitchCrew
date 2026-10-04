import { themeOptions } from '@/AppSidebar/constants.ts';
import type { DevicePreferencesProps } from '@/AppSidebar/types.ts';
import { DropdownMenu } from '@/components/ui/dropdown-menu/components/DropdownMenu.tsx';
import { DropdownMenuContent } from '@/components/ui/dropdown-menu/components/DropdownMenuContent.tsx';
import { DropdownMenuGroup } from '@/components/ui/dropdown-menu/components/DropdownMenuGroup.tsx';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu/components/DropdownMenuItem.tsx';
import { DropdownMenuLabel } from '@/components/ui/dropdown-menu/components/DropdownMenuLabel.tsx';
import { DropdownMenuRadioGroup } from '@/components/ui/dropdown-menu/components/DropdownMenuRadioGroup.tsx';
import { DropdownMenuRadioItem } from '@/components/ui/dropdown-menu/components/DropdownMenuRadioItem.tsx';
import { DropdownMenuSeparator } from '@/components/ui/dropdown-menu/components/DropdownMenuSeparator.tsx';
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu/components/DropdownMenuTrigger.tsx';
import { SidebarFooter } from '@/components/ui/sidebar/components/SidebarFooter.tsx';
import { SidebarMenu } from '@/components/ui/sidebar/components/SidebarMenu.tsx';
import { SidebarMenuButton } from '@/components/ui/sidebar/components/SidebarMenuButton.tsx';
import { SidebarMenuItem } from '@/components/ui/sidebar/components/SidebarMenuItem.tsx';
import type { ThemeChoice } from '@/theme.ts';
import { Copy } from 'lucide-react';
import { SetupShortcut } from '@/Onboarding/components/SetupShortcut.tsx';

export function DevicePreferences({
  ThemeIcon,
  theme,
  onTheme,
  dataDirectory,
  onCopyDirectory,
}: DevicePreferencesProps) {
  return (
    <SidebarFooter>
      <SidebarMenu>
        <SetupShortcut />
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger render={<SidebarMenuButton tooltip="Theme" />}>
              <ThemeIcon />
              <span>Theme</span>
              <span className="menu-value">
                {themeOptions.find((option) => option.id === theme)!.label}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="menu">
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value: ThemeChoice) => onTheme(value)}
              >
                <DropdownMenuLabel>Theme</DropdownMenuLabel>
                {themeOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.id} value={option.id} closeOnClick>
                    <option.icon /> {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<SidebarMenuButton size="lg" className="data-button" tooltip="Data folder" />}
            >
              <span className="local-dot" aria-hidden="true" />
              <span className="data-text">
                <strong>Saved on this device</strong>
                <code>
                  <bdi>{dataDirectory}</bdi>
                </code>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="menu data-menu">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Data folder</DropdownMenuLabel>
                <p className="data-path">{dataDirectory}</p>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onCopyDirectory}>
                <Copy /> Copy path
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
