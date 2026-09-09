/**
 * Validiert eine URL gegen SSRF-Angriffe.
 * Erlaubt nur http(s)://-URLs von öffentlichen Hosts.
 * Blockiert: localhost, private IP-Bereiche (IPv4 + IPv6), Cloud-Metadata,
 * dezimale/hexadezimale IP-Darstellungen, nicht-HTTP(S)-Schemata.
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

  let hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // Blockiere localhost und Loopback-Hostnamen
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return { ok: false, error: 'Lokale Adressen nicht erlaubt' };
  }

  // Blockiere Cloud-Metadata
  if (hostname === '169.254.169.254' || hostname === '169.254.170.2') {
    return { ok: false, error: 'Metadata-Adressen nicht erlaubt' };
  }

  // Dezimale IP-Darstellung erkennen (z.B. 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(hostname)) {
    const num = parseInt(hostname, 10);
    if (num < 0 || num > 4294967295) return { ok: false, error: 'Ungültige IP-Adresse' };
    const a = (num >>> 24) & 0xff;
    const b = (num >>> 16) & 0xff;
    const c = (num >>> 8) & 0xff;
    const d = num & 0xff;
    hostname = `${a}.${b}.${c}.${d}`;
  }

  // Hexadezimale oder oktale IP-Darstellung blockieren (z.B. 0x7f.0.0.1, 0177.0.0.1)
  if (/^0x[0-9a-f]+(\.[0-9a-f]+)*$/i.test(hostname) || /^[0-7]+(\.[0-7]+){3}$/.test(hostname)) {
    return { ok: false, error: 'Nicht-dezimale IP-Darstellung nicht erlaubt' };
  }

  // IPv4 private/reservierte Bereiche
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [a, b] = [parseInt(ipMatch[1]), parseInt(ipMatch[2])];
    if (a === 10) return { ok: false, error: 'Private IP nicht erlaubt' };
    if (a === 172 && b >= 16 && b <= 31) return { ok: false, error: 'Private IP nicht erlaubt' };
    if (a === 192 && b === 168) return { ok: false, error: 'Private IP nicht erlaubt' };
    if (a === 127) return { ok: false, error: 'Loopback nicht erlaubt' };
    if (a === 169 && b === 254) return { ok: false, error: 'Link-local nicht erlaubt' };
    if (a === 0) return { ok: false, error: 'Reservierte IP nicht erlaubt' };
    if (a >= 224) return { ok: false, error: 'Reservierte IP nicht erlaubt' };
  }

  // IPv6-Adressen blockieren (private, loopback, link-local, IPv4-mapped)
  if (hostname.includes(':')) {
    // ::1 Loopback
    if (hostname === '::1') return { ok: false, error: 'IPv6 Loopback nicht erlaubt' };
    // :: Unspecified
    if (hostname === '::') return { ok: false, error: 'Unspecified IPv6 nicht erlaubt' };
    // fc00::/7 Unique Local (fc* oder fd* Präfix)
    if (hostname.startsWith('fc') || hostname.startsWith('fd')) {
      return { ok: false, error: 'Private IPv6 (fc00::/7) nicht erlaubt' };
    }
    // fe80::/10 Link-Local
    if (hostname.startsWith('fe80')) {
      return { ok: false, error: 'Link-local IPv6 nicht erlaubt' };
    }
    // ::ffff:IPv4 IPv4-mapped — extrahiere IPv4 und prüfe
    const v4Mapped = hostname.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4Mapped) {
      const [a, b] = [parseInt(v4Mapped[1]), parseInt(v4Mapped[2])];
      if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
          a === 127 || (a === 169 && b === 254) || a === 0 || a >= 224) {
        return { ok: false, error: 'Private IP (IPv4-mapped IPv6) nicht erlaubt' };
      }
    }
  }

  return { ok: true };
}