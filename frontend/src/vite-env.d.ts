/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  /** NXTDesk widget script, e.g. https://nxtdesk-preview.pages.dev/widget.js. Unset = no widget. */
  readonly VITE_NXTDESK_URL?: string
  /** NXTDesk public widget key for FieldVibe (pk_…). Safe in front-end code. */
  readonly VITE_NXTDESK_KEY?: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Injected by vite define (see vite.config.ts): package version + build id.
declare const __APP_VERSION__: string