import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  // Travel CRM agency panel: served at <agency address>/agency/ next to the client portal (deploy/nginx-travel-agency-snippet.conf)
  base: '/agency/',
  // the Visa CRM apps use 5174-5176 locally
  server: { port: 5185 },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
