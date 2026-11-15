import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyBrand } from './lib/theme'

// platform colour for the admin panel
applyBrand()

// Apply dark class before first paint to avoid light→dark flash after PersistGate
try {
  const theme = localStorage.getItem('theme')
  const persisted = localStorage.getItem('persist:root')
  let dark = theme === 'dark'
  if (!dark && persisted) {
    try {
      const root = JSON.parse(persisted)
      const themeSlice = root?.theme ? JSON.parse(root.theme) : null
      dark = !!themeSlice?.darkMode
    } catch { /* ignore */ }
  }
  if (dark) document.documentElement.classList.add('dark')
} catch { /* ignore */ }

createRoot(document.getElementById('root')!).render(
    <App />
)
