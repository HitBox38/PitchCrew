/** A real document written into about:blank can still have a title and content. */
export const isBlankBrowserPage = (url: string | undefined, title: string | undefined) =>
  (!url || url === 'about:blank') && (!title || title === 'about:blank');
