export const profileFilenamePattern = /^[\w.-]+\.md$/;
export const maxEditedProfileFilenameLength = 100;

/** Directory listings include historical names with consecutive dots and long stems. */
export const isListedProfileFilename = (name: string) => profileFilenamePattern.test(name);

export const hasNoConsecutiveDots = (name: string) => !name.includes('..');

/** Writes also reject consecutive dots. Each operation supplies its own length bound. */
export const isWritableProfileFilename = (name: string) =>
  isListedProfileFilename(name) && hasNoConsecutiveDots(name);
