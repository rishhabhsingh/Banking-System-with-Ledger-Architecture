import { createContext, useCallback, useContext, useRef, useState } from "react"

const Ctx = createContext(null)
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const id = useRef(0)
  const push = useCallback((kind, message) => {
    const key = ++id.current
    setItems((s) => [...s.slice(-2), { key, kind, message }])
    setTimeout(() => setItems((s) => s.filter((t) => t.key !== key)), 4500)
  }, [])
  const api = useRef({ success: (m) => push("ok", m), error: (m) => push("bad", m) }).current
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => <div key={t.key} className={`toast ${t.kind}`} role={t.kind === "bad" ? "alert" : "status"}>{t.message}</div>)}
      </div>
    </Ctx.Provider>
  )
}
