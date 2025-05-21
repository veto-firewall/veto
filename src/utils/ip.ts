import { parse, parseCIDR, isValid as _isValid } from 'ipaddr.js';
import { ipClassificationCache } from './caching';

export function isPrivateIP(ip: string): boolean {
  if (ipClassificationCache.has(ip)) {
    return ipClassificationCache.get(ip) as boolean;
  }

  try {
    const addr = parse(ip);
    let isPrivate = false;

    if (addr.kind() === 'ipv4') {
      isPrivate = addr.range() !== 'unicast';
    } else {
      // For IPv6, check if it's unicast range
      isPrivate = addr.range() !== 'unicast';

      // Also check for loopback - ::1/128
      const ipString = addr.toString();
      if (ipString === '::1') {
        isPrivate = true;
      }
    }

    ipClassificationCache.set(ip, isPrivate);
    return isPrivate;
  } catch (error) {
    void error;
    return false;
  }
}

export function ipMatchesRange(ip: string, range: string): boolean {
  try {
    if (range.includes('/')) {
      const parsedRange = parseCIDR(range);
      const addr = parse(ip);
      return addr.match(parsedRange);
    } else if (range.includes('-')) {
      const [start, end] = range.split('-').map(part => parse(part.trim()));
      const addr = parse(ip);

      if (start.kind() !== end.kind() || addr.kind() !== start.kind()) {
        return false;
      }

      const startBigInt = BigInt(
        '0x' +
          start
            .toByteArray()
            .map((b: number) => b.toString(16).padStart(2, '0'))
            .join(''),
      );
      const endBigInt = BigInt(
        '0x' +
          end
            .toByteArray()
            .map((b: number) => b.toString(16).padStart(2, '0'))
            .join(''),
      );
      const addrBigInt = BigInt(
        '0x' +
          addr
            .toByteArray()
            .map((b: number) => b.toString(16).padStart(2, '0'))
            .join(''),
      );

      return addrBigInt >= startBigInt && addrBigInt <= endBigInt;
    } else {
      return ip === range;
    }
  } catch (error) {
    void error;
    return false;
  }
}
