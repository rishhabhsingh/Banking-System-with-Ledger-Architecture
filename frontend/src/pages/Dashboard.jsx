import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../api"
import { useAuth } from "../auth.jsx"
import { useToast } from "../toast.jsx"
import { greeting, groupNumber, last4, money, time, dayLabel } from "../format"
import Icon from "../components/Icon.jsx"
import CountUp from "../components/CountUp.jsx"
import Chart from "../components/Chart.jsx"

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const [accounts, setAccounts] = useState(null)
  const [sel, setSel] = useState(null)
  const [hist, setHist] = useState(null)
  const [recent, setRecent] = useState(null)
  const [busy, setBusy] = useState("")
  const [tick, setTick] = useState(0)

  const load = useCallback(async () => {
    try {
      const d = await api.accounts()
      setAccounts(d.accounts)
      setSel((s) => (s && d.accounts.some((a) => a._id === s) ? s : (d.accounts.find((a) => a.status === "ACTIVE") ?? d.accounts[0])?._id ?? null))
    } catch (e) { toast.error(e.message) }
  }, [toast])
  useEffect(() => { load() }, [load, tick])

  useEffect(() => {
    if (!sel) return
    let stale = false
    setHist(null); setRecent(null)
    Promise.all([api.history(sel, 30), api.ledger(sel, { limit: 5 })])
      .then(([h, l]) => { if (!stale) { setHist(h.points); setRecent(l.entries) } })
      .catch((e) => toast.error(e.message))
    return () => { stale = true }
  }, [sel, tick, toast])

  async function run(label, fn, ok) {
    setBusy(label)
    try { await fn(); toast.success(ok); setTick((t) => t + 1) } catch (e) { toast.error(e.message) } finally { setBusy("") }
  }
  const addAccount = () => run("new", () => api.createAccount(), "New account opened")
  const addFunds = () => run("funds", () => api.demoFunds({ toAccount: sel, amount: 10000, idempotencyKey: crypto.randomUUID() }), "₹10,000 demo money added")

  const total = accounts?.reduce((s, a) => s + a.balance, 0) ?? 0
  const current = accounts?.find((a) => a._id === sel)
  const flow = hist && { in: hist.reduce((s, p) => s + p.credit, 0), out: hist.reduce((s, p) => s + p.debit, 0) }

  if (accounts?.length === 0) {
    return (
      <div className="hero guilloche empty-hero">
        <h1>{greeting()}, {user.name.split(" ")[0]}.</h1>
        <p>Open your first account to start sending and receiving money.</p>
        <button className="btn brass" onClick={addAccount} disabled={busy === "new"}><Icon name="plus" size={18} />Open account</button>
      </div>
    )
  }

  return (
    <>
      <section className="hero guilloche">
        <div className="hero-top">
          <div>
            <p className="eyebrow">{greeting()}, {user.name.split(" ")[0]}</p>
            <p className="hero-label">Total balance</p>
            <div className="hero-amount">{accounts ? <CountUp value={total} /> : <span className="skel w-60" />}</div>
            <p className="hero-sub">{accounts ? `across ${accounts.length} account${accounts.length > 1 ? "s" : ""}` : ""}</p>
          </div>
          <div className="hero-actions">
            <Link className="btn brass" to={`/transfer${sel ? `?from=${sel}` : ""}`}><Icon name="send" size={18} />Send money</Link>
            <button className="btn glass" onClick={addFunds} disabled={busy === "funds" || !sel}><Icon name="plus" size={18} />Add ₹10,000 demo</button>
          </div>
        </div>
        <div className="hero-chart">
          <div className="hero-chart-head">
            <span>{current ? `Account ••${last4(current.accountNumber)} · last 30 days` : "Last 30 days"}</span>
            {flow && <span className="flow"><b className="in">+{money(flow.in)}</b> in <b className="out">−{money(flow.out)}</b> out</span>}
          </div>
          {hist ? <Chart points={hist} /> : <div className="skel chart-skel" />}
        </div>
      </section>

      <section className="block-head"><h2>Your accounts</h2><button className="link" onClick={addAccount} disabled={busy === "new"}>+ Open another</button></section>
      <div className="cards">
        {!accounts && [0, 1].map((i) => <div key={i} className="acard skel" />)}
        {accounts?.map((a) => (
          <button key={a._id} className={`acard guilloche-sm ${a._id === sel ? "on" : ""}`} onClick={() => setSel(a._id)} aria-pressed={a._id === sel}>
            <span className="acard-top"><span>Savings</span><em className={`chip ${a.status.toLowerCase()}`}>{a.status.toLowerCase()}</em></span>
            <span className="acard-num num">{groupNumber(a.accountNumber)}</span>
            <span className="acard-bal num">{money(a.balance)}</span>
          </button>
        ))}
      </div>

      <section className="block-head"><h2>Recent activity</h2>{sel && <Link to={`/accounts/${sel}`}>Full statement →</Link>}</section>
      <div className="panel">
        {!recent && [0, 1, 2].map((i) => <div key={i} className="row"><span className="skel w-100 h-20" /></div>)}
        {recent?.length === 0 && <p className="muted pad">No activity yet. Add demo money or receive a transfer.</p>}
        {recent?.map((e) => <EntryRow key={e._id} e={e} />)}
      </div>
    </>
  )
}

export function describe(e) {
  if (e.kind === "FUNDING") return e.note || "Funds added"
  if (e.kind === "REVERSAL") return `Reversal ${e.type === "DEBIT" ? "to" : "from"} ${groupNumber(e.counterparty || "")}`
  return `${e.type === "DEBIT" ? "Sent to" : "Received from"} ${e.counterparty ? groupNumber(e.counterparty) : "unknown"}`
}

export function EntryRow({ e, showDay }) {
  const out = e.type === "DEBIT"
  return (
    <div className="row">
      <span className={`ico ${out ? "out" : "in"}`}><Icon name={out ? "out" : "in"} size={18} /></span>
      <span className="row-main">
        <b>{describe(e)}</b>
        <small className="muted">{showDay ? time(e.createdAt) : `${dayLabel(e.createdAt)}, ${time(e.createdAt)}`}{e.note && e.kind !== "FUNDING" ? ` · ${e.note}` : ""}</small>
      </span>
      <span className={`amt num ${out ? "out" : "in"}`}>{out ? "−" : "+"}{money(e.amount)}</span>
    </div>
  )
}
