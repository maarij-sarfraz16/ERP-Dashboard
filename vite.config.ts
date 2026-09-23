/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { createApiMiddleware } from './server/api.mjs'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Sign-in, sign-out and the session-gated relay to Frappe, mounted inside
  // the dev server so development runs on one origin and one port, exactly as
  // production does under `npm start`. There is no second process to start and
  // no second port to remember: http://<this host>:5173 is the whole app.
  //
  // This replaces the old `/frappe-api` proxy, which attached the Frappe token
  // to anything that asked. The middleware attaches it only after checking the
  // session cookie. Nothing here touches the Frappe server's configuration.
  const dashboardServer = (): Plugin => ({
    name: 'ats-dashboard-server',
    configureServer(server) {
      const api = createApiMiddleware(env)
      server.middlewares.use((req, res, next) => {
        api(req, res, next)
      })
    },
  })

  return {
    plugins: [react(), dashboardServer()],

    // `npm test` runs the reconciliations against the live Frappe site (see
    // src/api/*.test.ts). There is no dev server under Vitest and therefore no
    // relay, so those tests dial Frappe directly. These names have no VITE_
    // prefix on purpose — Vite only exposes VITE_* to client code, so the
    // secret cannot reach the browser bundle through them.
    test: {
      env: {
        FRAPPE_API_BASE_URL: env.FRAPPE_API_BASE_URL ?? env.VITE_API_BASE_URL ?? '',
        FRAPPE_API_KEY: env.FRAPPE_API_KEY ?? env.VITE_FRAPPE_API_KEY ?? '',
        FRAPPE_API_SECRET: env.FRAPPE_API_SECRET ?? env.VITE_FRAPPE_API_SECRET ?? '',
      },
      testTimeout: 120_000,
      hookTimeout: 120_000,
    },

    server: {
      // Listen on every interface, not just localhost, so the "React Dashboard"
      // shortcut in the Frappe desk works from any machine on the LAN and not
      // only from the one running this dev server. The URL that shortcut points
      // at is this host's LAN address, so the port must not drift.
      host: true,
      port: 5173,
      strictPort: true,
    },
  }
})
