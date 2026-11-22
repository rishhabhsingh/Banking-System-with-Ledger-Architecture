import { useState } from "react"
import { api } from "../api"
import { useAuth } from "../auth.jsx"
import { useTheme } from "../theme.jsx"
import { useToast } from "../toast.jsx"
import Icon from "../components/Icon.jsx"

const FREQ = [
  ["OFF", "Off", "No scheduled emails"],
  ["WEEKLY", "Weekly", "Every Monday, for the week before"],
  ["MONTHLY", "Monthly", "On the 1st, for the previous month"]
]

export default function Settings() {
  const { user, setUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  async function setFreq(f) {
    if (f === user.statementFrequency) return
    setSaving(true)
    try { setUser((await api.setPreferences({ statementFrequency: f })).user); toast.success(f === "OFF" ? "Statement emails turned off" : `You’ll get a ${f.toLowerCase()} statement`) }
    catch (e) { toast.error(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="narrow">
      <h1>Settings</h1>

      <section className="panel pad">
        <h2>Profile</h2>
        <dl className="kv"><dt>Name</dt><dd>{user.name}</dd><dt>Email</dt><dd>{user.email}</dd></dl>
      </section>

      <section className="panel pad">
        <h2>Statement emails</h2>
        <p className="muted">A CSV of each account’s activity, sent to {user.email}.</p>
        <div className="options">
          {FREQ.map(([v, l, d]) => (
            <button key={v} className={`option ${user.statementFrequency === v ? "on" : ""}`} onClick={() => setFreq(v)} disabled={saving} aria-pressed={user.statementFrequency === v}>
              <b>{l}</b><small>{d}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel pad">
        <h2>Appearance</h2>
        <div className="seg">
          {[["system", "System"], ["light", "Light"], ["dark", "Dark"]].map(([v, l]) => <button key={v} className={theme === v ? "on" : ""} onClick={() => setTheme(v)}>{l}</button>)}
        </div>
      </section>
      <p className="muted small"><Icon name="shield" size={14} /> Your session lives in a secure, HTTP-only cookie.</p>
    </div>
  )
}
