import type { ConversationHeadingProps } from '../types.ts';
import { Button } from '@pitchcrew/design-system/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@pitchcrew/design-system/dropdown-menu';
import { ChevronDown, Ellipsis } from 'lucide-react';
import { ConversationMenuItems } from './ConversationMenuItems.tsx';

/**
 * The one conversation menu. On wider screens it is the header's ellipsis; on phones the
 * conversation's title in the 48px top bar opens it (`title`).
 */
export const ConversationActions = (props: ConversationHeadingProps & { title?: string }) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        props.title ? (
          <Button
            variant="ghost"
            className="chat-mobile-title"
            aria-label={`${props.title}, conversation options`}
          />
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Conversation options" />
        )
      }
    >
      {props.title ? (
        <>
          <span>{props.title}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </>
      ) : (
        <Ellipsis size={18} />
      )}
    </DropdownMenuTrigger>
    <DropdownMenuContent align={props.title ? 'start' : 'end'}>
      <ConversationMenuItems {...props} />
    </DropdownMenuContent>
  </DropdownMenu>
);
