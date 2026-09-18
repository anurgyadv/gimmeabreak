/**
 * Client-only Mock Service Worker bootstrap. Must never execute during
 * server rendering: `mockServiceWorker.js` (generated separately) and the
 * `msw/browser` runtime both assume a `window`/`navigator` environment.
 *
 * `startMockWorker` is idempotent and safe to call from multiple components;
 * it resolves `true` once the worker is intercepting requests, or `false` if
 * initialization failed or the code is not running in a browser. Callers
 * should treat `false` as "fall back to the direct dispatcher" rather than a
 * fatal error: `src/lib/api.ts` does exactly that automatically.
 */

let startPromise: Promise<boolean> | null = null;

export function startMockWorker(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  if (!startPromise) {
    startPromise = (async () => {
      try {
        const [{ setupWorker }, { handlers }] = await Promise.all([
          import('msw/browser'),
          import('./handlers'),
        ]);
        const worker = setupWorker(...handlers);
        await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
        return true;
      } catch (error) {
        console.warn(
          '[CoverAssist] Mock service worker failed to start; falling back to the direct simulation adapter.',
          error,
        );
        return false;
      }
    })();
  }

  return startPromise;
}
