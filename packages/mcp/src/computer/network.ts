import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const publicAddress = (address: string) => {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      // Only 192.0.0.0/24 (protocol assignments) and 192.0.2.0/24 (documentation) are special;
      // the rest of 192.0.0.0/16 is ordinary public space (iana.org is 192.0.43.8).
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  // Only global unicast IPv6; this also excludes mapped IPv4 and loopback.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address);
};

export const assertPublicUrl = async (value: string) => {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Only public HTTP(S) pages are available.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address)))
    throw new Error('Local and private network access is blocked, including Pitchcrew itself.');
};
