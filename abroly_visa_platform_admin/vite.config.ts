import fs from "node:fs"
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

/** react-aria 3.53+ deep-imports react-stately/private/* via nested package.json; Rollup needs help resolving those subpaths at build time. */
function resolveReactSpectrumSubpaths(): Plugin {
  return {
    name: "resolve-react-spectrum-subpaths",
    enforce: "pre",
    resolveId(source) {
      const match = /^react-(aria|stately)\/(.+)$/.exec(source)
      if (!match) return null
      const [, pkg, subpath] = match
      const root = path.resolve(__dirname, `node_modules/react-${pkg}`)
      const nestedPkg = path.join(root, subpath, "package.json")
      if (fs.existsSync(nestedPkg)) {
        const { module: mod, main } = JSON.parse(
          fs.readFileSync(nestedPkg, "utf-8"),
        ) as { module?: string; main?: string }
        const rel = mod ?? main
        if (rel) return path.resolve(path.dirname(nestedPkg), rel)
      }
      for (const ext of [".mjs", ".js"]) {
        const file = path.join(root, "dist/exports", `${subpath}${ext}`)
        if (fs.existsSync(file)) return file
      }
      return null
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [resolveReactSpectrumSubpaths(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // NextUI packages ship their own nested copies of these react-aria packages. Separate copies mean
    // separate focus-scope trees and overlay stacks, so a Modal treats its own Select/Dropdown popover as
    // "outside": the list closes the moment it opens, and picking an option closes the whole modal.
    // One shared copy of each fixes dropdowns inside modals.
    dedupe: [
      "@react-aria/focus",
      "@react-aria/overlays",
      "react-aria",
      "react-stately",
    ],
  },
})
