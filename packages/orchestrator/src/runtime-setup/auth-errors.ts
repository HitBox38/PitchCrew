/** Only locally authored, known-safe failures can cross the native sign-in boundary. */
export const runtimeSignInFailure = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';
  const known: Record<string, string> = {
    'Workspace storage is unavailable. Sign-in did not start.':
      'Workspace storage is unavailable. Sign-in did not start. Free space or restore access, then retry.',
    'Sign-in expired. Start again to get a new link.': 'Sign-in expired. Retry to get a new link.',
    'Sign-in output exceeded its limit.':
      'The CLI returned too much sign-in output. Retry or sign in from your terminal, then recheck.',
    'Could not start native sign-in. Recheck the runtime installation.':
      'The CLI could not start sign-in. Recheck its installation.',
    'The runtime executable is unavailable. Recheck its installation.':
      'The executable is no longer available. Return to Installation and recheck.',
    'The runtime returned an unsupported sign-in response.':
      'This CLI returned an unsupported sign-in response. Update it or sign in from your terminal, then recheck.',
    'The ACP agent could not complete sign-in. Recheck its authentication.':
      'The runtime could not finish its advertised sign-in method. Retry another method or recheck authentication.',
    'The private runtime authentication folder is unavailable.':
      'Workspace authentication storage is unavailable. Check its location and permissions before signing in.',
    'Codex sign-in did not complete. Start again.':
      'ChatGPT sign-in was not completed. Retry to start again.',
    'Codex could not complete native sign-in. Retry or use the CLI instructions.':
      'Codex could not start ChatGPT sign-in. Check the CLI’s login policy or use its terminal instructions.',
    'Native sign-in did not complete. Retry or use the CLI instructions.':
      'Sign-in was not completed. Retry or use the terminal instructions, then recheck.',
    'Native sign-in ended, but Pitchcrew could not verify account readiness. Recheck or use the CLI instructions.':
      'The CLI finished sign-in, but account readiness is still unverified. Recheck before continuing.',
  };
  return Object.hasOwn(known, message)
    ? known[message]
    : 'Sign-in failed. Retry, or use the CLI instructions and recheck.';
};
