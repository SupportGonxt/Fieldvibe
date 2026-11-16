/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  /** NXTDesk public widget key (pk_...). Empty = no support widget. */
  readonly VITE_NXTDESK_WIDGET_KEY?: string
  /** Optional override for the NXTDesk widget script URL. */
  readonly VITE_NXTDESK_WIDGET_URL?: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Injected by vite define (see vite.config.ts): package version + build id.
declare const __APP_VERSION__: string