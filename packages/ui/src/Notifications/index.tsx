import { NotificationBell } from './components/NotificationBell.tsx';

export { NotificationBell } from './components/NotificationBell.tsx';
export { NotificationCenter } from './components/NotificationCenter.tsx';
/** The bell alone; the toast stack lives in `NotificationCenter`, mounted once by the shell. */
export const Notifications = NotificationBell;
