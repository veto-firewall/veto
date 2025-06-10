/**
 * Export rules to a file
 */
import { exportRules as exportRulesFromBackground } from './BackgroundMessagingService';

/**
 * Export rules to a file
 *
 * @param baseId - The base ID of the rule element
 * @returns Promise that resolves when export is complete
 */
export async function exportRules(baseId: string): Promise<void> {
  try {
    const textarea = document.getElementById(baseId) as HTMLTextAreaElement;
    if (!textarea) {
      return;
    }

    // Get rules content from background
    let ruleContent = '';
    try {
      // Determine if we should include comments based on the content type
      const includeComments = [
        'allowed-asns',
        'blocked-asns',
        'allowed-domains',
        'blocked-domains',
        'allowed-ips',
        'blocked-ips',
        'allowed-regex',
        'blocked-regex',
      ].includes(baseId);

      const result = await exportRulesFromBackground(baseId, includeComments);

      if (typeof result === 'string') {
        ruleContent = result;
      } else if (result && typeof result === 'object') {
        // Safe type casting before using JSON.stringify
        const safeResult: Record<string, unknown> = result as Record<string, unknown>;
        ruleContent = JSON.stringify(safeResult, null, 2);
      }
    } catch (error) {
      void error;
      // In case of background communication error, get content directly from textarea
      ruleContent = textarea?.value || '';
    }

    // If no content, return
    if (!ruleContent || ruleContent.trim() === '') {
      return;
    }

    // Create a blob and trigger download with HTML5 Download API
    const blob = new Blob([ruleContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    try {
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `${baseId}.txt`;
      downloadLink.style.display = 'none';

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } finally {
      // Clean up the object URL
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  } catch (error) {
    console.error('Export error:', error);
  }
}
