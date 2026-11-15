# Context menus

The shared shadcn/Base UI Context Menu opens on right click or long press across the workspace, with the same clay material and reduced-motion transitions as other app menus.

Workspace backgrounds and ordinary content offer copying of selected text or the clicked link, Search workspace, Add job, New conversation, Go to page and Refresh workspace. Copy actions are disabled without a selection or link. Refresh reloads the workspace snapshot without reloading the page or discarding local form drafts. Navigation uses the existing router and unsaved-changes guards. Search and creation use the shell-owned dialogs and yield focus to them.

Highlighted text takes priority over other context menus and opens a copy-only **Copy selected text** menu. It captures the selected text before opening, including selections in text inputs, textareas, contenteditable editors and modal dialogs, and returns focus to the field or previous control after copying or dismissal. Copying preserves the field value and does not send a chat draft.

With no text highlighted, job cards, sidebar conversations, running queues and queued requests offer their existing action menus. The context and three-dot menus share action lists and handlers. Job moves, busy restrictions, queue commands, inline editing, archive/restore and deletion confirmations retain their existing behavior. Escape dismisses menus, and actions preserve their existing focus handoffs. Editing fields, contenteditable regions and modal dialogs without highlighted text keep their existing context-menu behavior; embedded browser documents keep their own menus.

Headless browser coverage exercises workspace navigation, search and creation, selection/link copying, highlighted text in fields, dialogs and chat drafts, contextual menu precedence, unselected editor exclusions, job moves and deletion, conversation archive/restore and deletion confirmation, running queue commands, queued-message editing and the existing three-dot alternatives.

## Contributor rules

App-wide right-click menus use the shared shadcn/Base UI Context Menu family. Isolated native browser guests use Electron editing/link context menus. Workspace surfaces offer selection/link copying, search, job/conversation creation, navigation and snapshot refresh; job cards, sidebar conversations, running queues and queued requests share their existing contextual actions and restrictions with their three-dot menus. Highlighted text opens a copy-only menu before contextual resource actions, including selections in text inputs, textareas, contenteditable editors and modal dialogs; fields without selected text retain their existing context-menu behavior. Menus preserve guarded navigation, confirmation dialogs, action-owned focus restoration and reduced motion.
