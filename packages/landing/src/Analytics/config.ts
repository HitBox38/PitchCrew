export const analyticsConfig = {
  token:
    process.env.NEXT_PUBLIC_POSTHOG_TOKEN ?? 'phc_tBP4CMbPTY7nhuKc6qYt9gn7h3BHHsyzhyaxsyZR9r8y',
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
};

export function analyticsConfigured(): boolean {
  if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_POSTHOG_DEV !== '1')
    return false;
  if (!/^phc_[a-zA-Z0-9_-]{8,200}$/.test(analyticsConfig.token)) return false;
  try {
    const url = new URL(analyticsConfig.host);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
