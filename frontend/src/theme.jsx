import { createContext, useContext, useEffect, useState } from "react"

const Ctx = createContext(null)
export const useTheme = () => useContext(Ctx)

// "system" follows the OS. The saved choice is applied before first paint in main.jsx.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("theme") || "system" } catch { return "system" } })
  useEffect(() => {
    const el = document.documentElement
    theme === "system" ? el.removeAttribute("data-theme") : el.setAttribute("data-theme", theme)
    try { localStorage.setItem("theme", theme) } catch { /* private mode */ }
  }, [theme])
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  return <Ctx.Provider value={{ theme, setTheme, isDark, toggle: () => setTheme(isDark ? "light" : "dark") }}>{children}</Ctx.Provider>
}
