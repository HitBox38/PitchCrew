// Only explicit connector setup links can leave the sandboxed renderer.
export function isConnectorExternalUrl(value: string) {
  return (
    isGoogleAuthorizationUrl(value) ||
    value === 'https://cli.github.com/' ||
    value === 'https://github.com/googleworkspace/cli'
  );
}

export function isGoogleAuthorizationUrl(value: string) {
  try {
    const url = new URL(value);
    const redirect = new URL(url.searchParams.get('redirect_uri') ?? '');
    return (
      url.origin === 'https://accounts.google.com' &&
      url.pathname === '/o/oauth2/v2/auth' &&
      !url.username &&
      !url.password &&
      redirect.protocol === 'http:' &&
      redirect.hostname === '127.0.0.1' &&
      !redirect.username &&
      !redirect.password &&
      redirect.pathname === '/oauth/google' &&
      url.searchParams.get('response_type') === 'code' &&
      url.searchParams.get('code_challenge_method') === 'S256' &&
      !!url.searchParams.get('state') &&
      !!url.searchParams.get('code_challenge')
    );
  } catch {
    return false;
  }
}
