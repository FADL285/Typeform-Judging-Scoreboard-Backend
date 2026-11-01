import { isIP } from 'node:net';
export function trustedProxies(value) {
  if (!value?.trim()) return false;
  const entries = value.split(',').map(entry => entry.trim());
  for (const entry of entries) {
    const [address, prefix, extra] = entry.split('/');
    const family = isIP(address);
    if (!family || extra || (prefix !== undefined && (!/^\d+$/.test(prefix) || (Number(prefix) === 0 || Number(prefix) > (family === 4 ? 32 : 128))))) {
      throw new Error('SCOREBOARD_TRUST_PROXY must list exact trusted proxy IPs or CIDRs; unrestricted trust is not allowed');
    }
  }
  return entries;
}
