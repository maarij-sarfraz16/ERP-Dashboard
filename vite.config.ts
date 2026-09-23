import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_API_BASE_URL ?? ''
  const useProxy = env.VITE_USE_DEV_PROXY !== 'false'
  const apiKey = env.VITE_FRAPPE_API_KEY ?? ''
  const apiSecret = env.VITE_FRAPPE_API_SECRET ?? ''

  return {
    plugins: [react()],
    server: {
      // Listen on every interface, not just localhost, so the "React Dashboard"
      // shortcut in the Frappe desk works from any machine on the LAN and not
      // only from the one running this dev server. The URL that shortcut points
      // at is this host's LAN address, so the port must not drift.
      host: true,
      port: 5173,
      strictPort: true,

      // Dev-only escape hatch for CORS. The browser refuses cross-origin
      // requests unless the Frappe server lists this app's origin under
      // `allow_cors`; routing through Vite makes every request same-origin,
      // because Vite calls Frappe server-side where CORS does not apply.
      //
      // The app talks to `/frappe-api/...` when this is on (see
      // `src/api/frappeClient.ts`). Production builds have no dev server, so
      // there `allow_cors` on Frappe is mandatory.
      proxy:
        useProxy && target
          ? {
              '/frappe-api': {
                target,
                changeOrigin: true,
                rewrite: (path: string) => path.replace(/^\/frappe-api/, ''),
                // Employee photos under `/private/files/` are 403 without
                // auth, and an `<img>` tag cannot attach the token header the
                // API calls use. Add it here so photo requests routed through
                // the proxy are authenticated too (API calls already send the
                // same token, so this is a no-op for them).
                headers:
                  apiKey && apiSecret
                    ? { Authorization: `token ${apiKey}:${apiSecret}` }
                    : undefined,
              },
            }
          : undefined,
    },
  }
})
