import { Navigate, NavLink, Route, Routes } from "react-router-dom"
import { useAuth } from "./auth.jsx"
import { useTheme } from "./theme.jsx"
import Icon, { Logo } from "./components/Icon.jsx"
import Auth from "./pages/Auth.jsx"
import Dashboard from "./pages/Dashboard.jsx"
import Transfer from "./pages/Transfer.jsx"
import Statement from "./pages/Statement.jsx"
import Settings from "./pages/Settings.jsx"
import Admin from "./pages/Admin.jsx"

function Shell({ children }) {
  const { user, logout } = useAuth()
  const { isDark, toggle } = useTheme()
  const items = [
    { to: "/", icon: "home", label: "Home", end: true },
    { to: "/transfer", icon: "send", label: "Send" },
    { to: "/settings", icon: "sliders", label: "Settings" },
    ...(user.isAdmin ? [{ to: "/admin", icon: "bank", label: "Admin" }] : [])
  ]
  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><Logo /><span>Ledger Bank</span></div>
        <nav aria-label="Main">
          {items.map((i) => <NavLink key={i.to} to={i.to} end={i.end}><Icon name={i.icon} />{i.label}</NavLink>)}
        </nav>
        <div className="side-foot">
          <button className="ghost-btn" onClick={toggle} aria-label="Toggle dark mode"><Icon name={isDark ? "sun" : "moon"} />{isDark ? "Light mode" : "Dark mode"}</button>
          <div className="user-chip">
            <span className="avatar" aria-hidden="true">{user.name[0]}</span>
            <span className="user-name">{user.name}</span>
            <button className="icon-btn" onClick={logout} aria-label="Log out" title="Log out"><Icon name="logout" size={18} /></button>
          </div>
        </div>
      </aside>
      <header className="mobile-top"><div className="brand"><Logo size={28} /><span>Ledger Bank</span></div>
        <button className="icon-btn" onClick={toggle} aria-label="Toggle dark mode"><Icon name={isDark ? "sun" : "moon"} /></button></header>
      <main className="main">{children}</main>
      <nav className="tabbar" aria-label="Main">
        {items.map((i) => <NavLink key={i.to} to={i.to} end={i.end}><Icon name={i.icon} /><span>{i.label}</span></NavLink>)}
      </nav>
    </div>
  )
}

const Splash = () => <div className="splash"><Logo size={44} /></div>

function Private({ children, admin }) {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace />
  if (admin && !user.isAdmin) return <Navigate to="/" replace />
  return <Shell>{children}</Shell>
}
function Public({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Public><Auth mode="login" /></Public>} />
      <Route path="/register" element={<Public><Auth mode="register" /></Public>} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/transfer" element={<Private><Transfer /></Private>} />
      <Route path="/accounts/:id" element={<Private><Statement /></Private>} />
      <Route path="/settings" element={<Private><Settings /></Private>} />
      <Route path="/admin" element={<Private admin><Admin /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
