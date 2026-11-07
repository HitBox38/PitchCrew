/** The mutation was acknowledged; only its following read failed. Never resend it automatically. */
export class ActionRefreshError extends Error {
  readonly mutationAccepted = true;
  constructor(
    readonly result: unknown,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : 'Saved, but the workspace could not refresh.', {
      cause,
    });
    this.name = 'ActionRefreshError';
  }
}
