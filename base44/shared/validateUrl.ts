/**
 * Validiert eine URL gegen SSRF-Angriffe.
 * Erlaubt nur http(s)://-URLs von öffentlichen Hosts.
 * Blockiert: localhost, private IP-Bereiche, Cloud-Metadata, nicht-HTTP(S)-Schemata.
 */
export function validateSafeUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { ok: false, error: 'Ungültige URL' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: `Schema ${parsed.protocol} nicht erlaubt` };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // Blockiere localhost und Loopback
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return { ok: false, error: 'Lokale Adressen nicht erlaubt' };
  }

  // Blockiere Cloud-Metadata
  if (hostname === '169.254.169.254' || hostname === '169.254.170.2') {
    return { ok: false, error: 'Metadata-Adressen nicht erlaubt' };
  }

  // Blockiere private IP-Bereiche
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [a, b] = [parseInt(ipMatch[1]), parseInt(ipMatch[2])];
    if (a === 10) return { ok: false, error: 'Private IP nicht erlaubt' };
    if (a === 172 && b >= 16 && b <= 31) return { ok: false, error: 'Private IP nicht erlaubt' };
    if (a === 192 && b === 168) return { ok: false, error: 'Private IP nicht erlaubt' };
    if (a === 127) return { ok: false, error: 'Loopback nicht erlaubt' };
    if (a === 169 && b === 254) return { ok: false, error: 'Link-local nicht erlaubt' };
    if (a === 0) return { ok: false, error: 'Reservierte IP nicht erlaubt' };
  }

  return { ok: true };
}