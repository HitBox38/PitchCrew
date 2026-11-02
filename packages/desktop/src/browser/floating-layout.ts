export const floatingToolbarHeight = 72;

/** Presentation dimensions only. Never apply these to the inspected guest. */
export const floatingContentSize = (
  page: { width: number; height: number },
  available: { width: number; height: number },
) => {
  const scale = Math.min(
    1,
    available.width / page.width,
    Math.max(1, available.height - floatingToolbarHeight) / page.height,
  );
  return {
    width: Math.min(available.width, Math.max(400, Math.ceil(page.width * scale))),
    height: Math.min(available.height, Math.ceil(page.height * scale) + floatingToolbarHeight),
  };
};
