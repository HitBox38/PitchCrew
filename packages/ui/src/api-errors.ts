/** An HTTP failure response, without an inference about mutation persistence or retryability. */
export class ApiHttpError extends Error {
  readonly serverMessage: string | undefined;

  constructor(
    readonly status: number,
    serverMessage?: string,
    options?: ErrorOptions,
  ) {
    const reason =
      typeof serverMessage === 'string' && serverMessage.trim() ? serverMessage : undefined;
    super(reason ?? 'Request failed.', options);
    this.name = 'ApiHttpError';
    this.serverMessage = reason;
  }
}
