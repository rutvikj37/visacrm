import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // NextUI packages ship their own nested copies of these react-aria packages. Separate copies mean
    // separate focus-scope trees and overlay stacks, so a Modal treats its own Select/Dropdown popover as
    // "outside": the list closes the moment it opens, and picking an option closes the whole modal.
    // One shared copy of each fixes dropdowns inside modals.
    dedupe: ["@react-aria/focus", "@react-aria/overlays"],
  },
})
