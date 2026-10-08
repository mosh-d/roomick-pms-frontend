/**
 * Copies text, saying whether it worked. `navigator.clipboard` is absent on
 * a plain-http address (a front-desk PC on the office network) and rejects
 * when the page isn't focused — the old unguarded `writeText` left an
 * unhandled rejection in the console and a button that said nothing. The
 * fallback is the old selection-and-copy route.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the selection route
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied;
  } catch {
    return false;
  }
}
