/**
 * Readable words in a document: runs that start with a letter or digit, so Markdown markers
 * (`#`, `-`, `**`) never count. The chat Packet panel and file tiles share this one rule.
 */
export const readableWordCount = (text: string) =>
  (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
