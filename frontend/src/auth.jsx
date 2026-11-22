import { createContext, useContext, useEffect, useState } from "react"
import { api } from "./api"

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.me().then((d) => setUser(d.user)).catch(() => setUser(null)).finally(() => setLoading(false)) }, [])
  const value = {
    user, loading, setUser,
    login: async (b) => setUser((await api.login(b)).user),
    register: async (b) => setUser((await api.register(b)).user),
    logout: async () => { await api.logout().catch(() => {}); setUser(null) }
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}
