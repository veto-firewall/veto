/**
 * Logger utility for VETO extension
 * Handles console logging for blocked requests and other events
 */

type BlockReason = 'ip' | 'asn' | 'geoip' | 'domain' | 'url' | 'regex' | 'private-ip' | 'content';

/**
 * Returns a user-friendly resource type name
 */
function getReadableResourceType(type?: string): string {
  if (!type) return 'unknown';

  const typeMap: Record<string, string> = {
    main_frame: 'page',
    sub_frame: 'frame',
    stylesheet: 'css',
    script: 'js',
    image: 'img',
    font: 'font',
    object: 'obj',
    xmlhttprequest: 'xhr',
    ping: 'ping',
    csp_report: 'csp',
    media: 'media',
    websocket: 'ws',
    other: 'other',
  };

  return typeMap[type] || type;
}

/**
 * Converts the block reason to a human-readable text
 */
function getBlockReasonText(reason: BlockReason): string {
  const reasonMap: Record<BlockReason, string> = {
    'ip': 'IP address match',
    'asn': 'ASN (network provider) match',
    'geoip': 'Geographic location match',
    'domain': 'Domain name match',
    'url': 'URL pattern match',
    'regex': 'Regular expression match',
    'private-ip': 'Private IP address blocked',
    'content': 'Content type blocking (image/font/media)',
  };

  return reasonMap[reason] || 'Unknown reason';
}

interface RequestLogData {
  url: string;
  domain: string;
  location?: string;
  ip?: string;
  asn?: string | number;
  resourceType?: string;
  blockReason: BlockReason;
}

/**
 * Logs a blocked request to the browser console
 * @param data Information about the blocked request
 */
export function logBlockedRequest(data: RequestLogData): void {
  // Log to extension's background console only
  const readableType = getReadableResourceType(data.resourceType);
  const reason = getBlockReasonText(data.blockReason);

  console.log(
    `%cVETO Blocked Request%c\n` +
      `${data.url}\n` +
      `REASON: ${reason}\n` +
      `${data.domain} | ` +
      `${data.location || 'Unknown'} | ` +
      `${data.ip || 'Unknown'} | ` +
      `${data.asn || 'Unknown'} | ` +
      `${readableType}`,
    'color: #ff4d4f; font-weight: bold; background: #fff2f0; padding: 2px 5px; border-radius: 3px;',
    'color: inherit;',
  );
}
