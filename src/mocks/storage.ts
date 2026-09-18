/**
 * Versioned localStorage persistence with a safe in-memory fallback.
 * Used by the engine so demo state survives a browser refresh while Node
 * tests (and server rendering, where `window` does not exist) fall back to
 * memory without ever touching browser APIs.
 */

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

interface Envelope<T> {
  version: number;
  data: T;
}

export function loadPersisted<T>(key: string, version: number): T | null {
  if (!hasLocalStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Envelope<T>> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== version) {
      return null;
    }
    return (parsed.data ?? null) as T | null;
  } catch {
    // Corrupt or unparsable value: behave as if nothing were stored.
    return null;
  }
}

export function savePersisted<T>(key: string, version: number, data: T): void {
  if (!hasLocalStorage()) return;
  try {
    const envelope: Envelope<T> = { version, data };
    window.localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Quota exceeded or storage disabled: demo continues in-memory only.
  }
}

export function clearPersisted(key: string): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}
