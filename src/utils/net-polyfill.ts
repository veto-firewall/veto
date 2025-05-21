// Simple polyfill for node's net.isIP function used by mmdb-lib
import { parse } from 'ipaddr.js';

// Export the minimal interface needed by mmdb-lib
export default {
  isIP: (ip: string): number => {
    try {
      const addr = parse(ip);
      return addr.kind() === 'ipv4' ? 4 : 6;
    } catch (error) {
      void error;
      return 0;
    }
  },
};
