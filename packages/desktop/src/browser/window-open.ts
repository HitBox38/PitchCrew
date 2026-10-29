import type { HandlerDetails } from 'electron';

/** Links belong in DOM tabs; real script windows retain Chromium's opener. */
export const browserWindowOpenAction = (details: HandlerDetails) => {
  if (details.url !== 'about:blank' && !/^https?:\/\//i.test(details.url)) return 'deny';
  if (
    details.url !== 'about:blank' &&
    !details.postBody &&
    ['foreground-tab', 'background-tab'].includes(details.disposition)
  )
    return 'tab';
  return 'popup';
};
