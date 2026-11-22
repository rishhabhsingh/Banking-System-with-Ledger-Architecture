import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// The proxy makes /api same-origin in dev, so the httpOnly login cookie just works (no CORS pain).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:3000" } }
})
