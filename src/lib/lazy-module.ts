/**
 * Dynamic imports can fail after a new deployment: the browser still holds the
 * old HTML and asks for a chunk file name that no longer exists on the server
 * ("Failed to fetch dynamically imported module"). Retry, then reload once so
 * the page picks up the current build instead of showing a dead-end error.
 */
const RELOAD_FLAG = "mcd:chunk-reload";

function isChunkLoadError(e: unknown) {
  const msg = String((e as Error)?.message ?? e ?? "");
  return (
    /dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

export async function retryImport<T>(load: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await load();
    } catch (e) {
      lastError = e;
      if (!isChunkLoadError(e)) throw e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }

  if (typeof window !== "undefined" && isChunkLoadError(lastError)) {
    const already = sessionStorage.getItem(RELOAD_FLAG);
    if (!already || Date.now() - Number(already) > 60_000) {
      sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
      window.location.reload();
      // Keep the caller pending while the page reloads.
      return new Promise<T>(() => {});
    }
  }

  throw new Error(
    "The app was updated. Please refresh the page (Ctrl/Cmd + Shift + R) and try the download again.",
  );
}
