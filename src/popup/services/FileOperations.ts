/**
 * Export rules to a file
 *
 * @param baseId - The base ID of the rule element
 * @returns Promise that resolves when export is complete
 */
export async function exportRules(baseId: string): Promise<void> {
  try {
    console.log(`DEBUG: Starting export for ${baseId}`);

    const textarea = document.getElementById(baseId) as HTMLTextAreaElement;
    if (!textarea) {
      console.log(`DEBUG: Could not find textarea for ${baseId}`);
      return;
    }

    // Get rules content from background
    let ruleContent = '';
    try {
      console.log('DEBUG: Sending exportRules message to background');

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

      const result = (await browser.runtime.sendMessage({
        type: 'exportRules',
        ruleType: baseId,
        includeComments: includeComments,
      })) as string | Record<string, unknown>;

      console.log(`DEBUG: Got export result type: ${typeof result}`);

      if (typeof result === 'string') {
        ruleContent = result;
      } else if (result && typeof result === 'object') {
        // Safe type casting before using JSON.stringify
        const safeResult: Record<string, unknown> = result as Record<string, unknown>;
        ruleContent = JSON.stringify(safeResult, null, 2);
      }
    } catch (error) {
      console.log(
        `DEBUG: Export background error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // In case of background communication error, get content directly from textarea
      ruleContent = textarea?.value || '';
      console.log('DEBUG: Using textarea content as fallback');
    }

    // If no content, show message and return
    if (!ruleContent || ruleContent.trim() === '') {
      console.log('DEBUG: No content to export');
      return;
    }

    console.log(`DEBUG: Export content length: ${ruleContent.length} characters`);

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

      console.log('DEBUG: Export download initiated');
    } finally {
      // Clean up the object URL
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  } catch (error) {
    console.log(
      `DEBUG: Top-level exportRules error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
