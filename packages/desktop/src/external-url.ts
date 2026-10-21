/** Only web URLs may be handed to the system browser, never files or native protocols. */
export const isAllowedExternalUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
    );
  } catch {
    return false;
  }
};
