/** An HTTP failure response, without an inference about mutation persistence or retryability. */
export class ApiHttpError extends Error {
  readonly serverMessage: string | undefined;
  /** The parsed JSON error body, for routes that return details such as a conflicting copy. */
  readonly body: unknown;

  constructor(
    readonly status: number,
    serverMessage?: string,
    options?: ErrorOptions & { body?: unknown },
  ) {
    const reason =
      typeof serverMessage === 'string' && serverMessage.trim() ? serverMessage : undefined;
    super(reason ?? 'Request failed.', options);
    this.name = 'ApiHttpError';
    this.serverMessage = reason;
    this.body = options?.body;
  }
}
