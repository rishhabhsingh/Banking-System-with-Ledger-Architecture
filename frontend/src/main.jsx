import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import "@fontsource-variable/instrument-sans"
import "@fontsource-variable/newsreader"
import App from "./App.jsx"
import { AuthProvider } from "./auth.jsx"
import { ThemeProvider } from "./theme.jsx"
import { ToastProvider } from "./toast.jsx"
import "./styles.css"

try { const t = localStorage.getItem("theme"); if (t && t !== "system") document.documentElement.dataset.theme = t } catch { /* ignore */ }

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)
