import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../auth.jsx"
import Icon, { Logo } from "../components/Icon.jsx"

export default function Auth({ mode }) {
  const isLogin = mode === "login"
  const { login, register } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ name: "", email: "", password: "" })
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError(""); setBusy(true)
    try { await (isLogin ? login({ email: form.email, password: form.password }) : register(form)); nav("/") }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="auth">
      <section className="auth-hero guilloche">
        <div className="brand light"><Logo /><span>Ledger Bank</span></div>
        <div>
          <h1>Every rupee,<br />accounted for twice.</h1>
          <p>Each payment is written as a matching debit and credit, so your balance is always the sum of the book.</p>
          <ul className="proofs">
            <li><Icon name="shield" size={18} />Entries can never be edited or deleted</li>
            <li><Icon name="check" size={18} />Retry-safe payments: a tap never pays twice</li>
            <li><Icon name="download" size={18} />Statements as CSV, or in your inbox</li>
          </ul>
        </div>
        <small>Demo banking app. No real money moves.</small>
      </section>

      <section className="auth-panel">
        <form onSubmit={submit} className="auth-form">
          <h2>{isLogin ? "Welcome back" : "Open your account"}</h2>
          <p className="muted">{isLogin ? "Log in to see your accounts." : "Takes under a minute."}</p>
          {!isLogin && <label>Full name<input value={form.name} onChange={set("name")} required autoComplete="name" /></label>}
          <label>Email<input type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></label>
          <label>Password
            <span className="pw">
              <input type={show ? "text" : "password"} value={form.password} onChange={set("password")} required minLength={isLogin ? 1 : 8} autoComplete={isLogin ? "current-password" : "new-password"} />
              <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}><Icon name={show ? "eyeOff" : "eye"} size={18} /></button>
            </span>
            {!isLogin && <small className="muted">At least 8 characters</small>}
          </label>
          {error && <p className="alert bad" role="alert">{error}</p>}
          <button className="btn block" disabled={busy}>{busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}</button>
          <p className="muted center-text">{isLogin ? <>New here? <Link to="/register">Create an account</Link></> : <>Already registered? <Link to="/login">Log in</Link></>}</p>
        </form>
      </section>
    </div>
  )
}
