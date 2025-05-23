/**
 * LoggingService provides centralized logging functionality for the extension
 * Handles console logging for blocked requests and other events
 */
import type { IService } from '../types';

/**
 * Block reason types for request blocking
 */
export type BlockReason =
  | 'ip'
  | 'asn'
  | 'geoip'
  | 'domain'
  | 'url'
  | 'regex'
  | 'private-ip'
  | 'content';

/**
 * Request log data interface containing information about blocked requests
 */
export interface RequestLogData {
  url: string;
  domain: string;
  location?: string;
  ip?: string;
  asn?: string | number;
  resourceType?: browser.declarativeNetRequest.ResourceType | string;
  blockReason: BlockReason;
}

/**
 * Service for managing logging operations
 */
export class LoggingService implements IService {
  /**
   * Initialize the logging service
   * @returns Promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Returns a user-friendly resource type name
   * Uses the same resource types as declarativeNetRequest API
   * @param type - The resource type to convert
   * @returns A human-readable name for the resource type
   */
  private getReadableResourceType(
    type?: browser.declarativeNetRequest.ResourceType | string,
  ): string {
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
   * @param reason - The block reason code
   * @returns A human-readable description of why the request was blocked
   */
  private getBlockReasonText(reason: BlockReason): string {
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

  /**
   * Logs a blocked request to the browser console
   * @param data - Information about the blocked request
   */
  logBlockedRequest(data: RequestLogData): void {
    // Log to extension's background console only
    const readableType = this.getReadableResourceType(data.resourceType);
    const reason = this.getBlockReasonText(data.blockReason);

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
}
