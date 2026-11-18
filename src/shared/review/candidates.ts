/**
 * Review switch for the biology candidates (B1-B5): `?bio=off` turns all of them off so a
 * reviewer can compare against the former behaviour; anything else (including Node, which
 * has no `location`) leaves them on. Read once and cached. Scene assembly passes the "off"
 * values through each factory's options; the switch constants themselves are not touched.
 */
let cached: boolean | undefined;
export function biologyCandidatesEnabled(): boolean {
  if (cached !== undefined) return cached;
  let search = '';
  try { search = (globalThis as {location?: {search?: string}}).location?.search ?? ''; } catch { search = ''; }
  cached = new URLSearchParams(search).get('bio') !== 'off';
  return cached;
}
