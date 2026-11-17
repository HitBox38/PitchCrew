/** The reading tray's page gutters, from the viewer's CSS so phones and desktops share one source. */
export const readGutters = (element: Element) => {
  const style = getComputedStyle(element);
  const read = (name: string, fallback: number) =>
    parseFloat(style.getPropertyValue(name)) || fallback;
  return {
    top: read('--file-gutter-top', 56),
    x: read('--file-gutter-x', 32),
    bottom: read('--file-gutter-bottom', 32),
  };
};
