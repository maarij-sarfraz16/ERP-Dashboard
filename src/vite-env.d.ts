/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_FRAPPE_API_KEY: string;
  readonly VITE_FRAPPE_API_SECRET: string;
  /** "false" disables Vite's dev proxy and calls Frappe directly. */
  readonly VITE_USE_DEV_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
