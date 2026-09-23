/// <reference types="vite/client" />

// Deliberately empty of backend settings. The Frappe address, API key and API
// secret are read only by the server (`server/api.mjs`) and are NOT VITE_*
// prefixed, so Vite cannot expose them to the browser bundle. Client code
// talks to `/frappe-api` on its own origin instead — see `src/api/frappeClient.ts`.
interface ImportMetaEnv {
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
