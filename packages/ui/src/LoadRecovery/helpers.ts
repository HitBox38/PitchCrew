/** Browser and Vite wording for a lazily loaded file that could not be fetched or evaluated. */
const moduleLoadPattern =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Outdated Optimize Dep|ChunkLoadError|Loading chunk [\w-]+ failed|Unable to preload CSS/i;

export const isModuleLoadError = (error: unknown) =>
  error instanceof Error
    ? moduleLoadPattern.test(`${error.name} ${error.message}`)
    : moduleLoadPattern.test(String(error));

/** Copyable text for the Details disclosure; the main copy never shows it. */
export const technicalDetail = (error: unknown) => {
  if (error instanceof Error) return `${error.name}: ${error.message}`.slice(0, 2000);
  return String(error).slice(0, 2000);
};

export interface LoadFailureCopy {
  title: string;
  body: string;
  /**
   * Whether rendering again can help. A file that failed to download cannot: the browser keeps
   * the failed module for the life of the window, so only a reload fetches it again.
   */
  retryable: boolean;
}

/** Plain product wording; what failed, what is safe and what the next step does. */
export const loadFailureCopy = (error: unknown, subject: string): LoadFailureCopy =>
  isModuleLoadError(error)
    ? {
        title: `${subject} didn’t load`,
        body: 'Pitchcrew couldn’t download part of the app, which can happen after an update or restart. Reloading Pitchcrew fetches it again. Your saved jobs, packets and conversations are safe.',
        retryable: false,
      }
    : {
        title: `${subject} stopped working`,
        body: 'Something went wrong while showing it. Your saved jobs, packets and conversations are safe, and unsent drafts stay while this window is open.',
        retryable: true,
      };

export const reloadWarning =
  'Saved jobs, packets and conversations stay. Unsent messages and unsaved edits in this window are lost.';

export const reloadBlocked =
  'This window is still open, possibly because an editor has unsaved changes. Save or discard them, then reload.';
