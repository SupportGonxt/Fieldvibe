// Running build id, injected by vite define from package.json version + the
// SW BUILD_ID (see vite.config.ts). Single source for "what release am I on".
export const APP_VERSION: string = __APP_VERSION__

// Ask the active service worker to check for a newer build right now. Called on
// app focus so a returning field user picks up a deploy within seconds instead
// of waiting for main.tsx's hourly poll. If a newer SW exists it installs,
// skipWaiting/clientsClaim, and main.tsx's controllerchange reloads the shell.
// Best-effort — offline or unsupported just resolves quietly.
export async function checkForUpdate(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    await reg?.update()
  } catch { /* offline / unsupported — ignore */ }
}
