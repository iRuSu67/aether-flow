/**
 * Deterministic deep structural equality helper for comparing candidate tool outputs
 * against agent-visible example outputs without relying on hidden test oracles.
 */
export function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;

  // Number comparison with floating point tolerance
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 1e-4;
  }

  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as Record<string, unknown>).sort();
    const keysB = Object.keys(b as Record<string, unknown>).sort();
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i++) {
      const key = keysA[i];
      if (key !== keysB[i]) return false;
      if (!deepEquals((a as any)[key], (b as any)[key])) return false;
    }
    return true;
  }

  return false;
}
