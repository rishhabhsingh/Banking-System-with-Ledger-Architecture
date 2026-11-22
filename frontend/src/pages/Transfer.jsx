import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { api } from "../api"
import { useToast } from "../toast.jsx"
import { groupNumber, last4, money, when } from "../format"
import Icon from "../components/Icon.jsx"

const QUICK = [500, 1000, 5000]

export default function Transfer() {
  const [params] = useSearchParams()
  const toast = useToast()
  const [accounts, setAccounts] = useState(null)
  const [recents, setRecents] = useState([])
  const [step, setStep] = useState("details") // details | review | done
  const [from, setFrom] = useState(params.get("from") || "")
  const [to, setTo] = useState("")
  const [recipient, setRecipient] = useState(null)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [receipt, setReceipt] = useState(null)
  const [busy, setBusy] = useState(false)
  const key = useRef(crypto.randomUUID()) // kept across network failures so a retry can never pay twice

  useEffect(() => {
    api.accounts().then((d) => {
      const active = d.accounts.filter((a) => a.status === "ACTIVE")
      setAccounts(active)
      setFrom((f) => (active.some((a) => a._id === f) ? f : active[0]?._id || ""))
    }).catch((e) => toast.error(e.message))
    api.recents().then((d) => setRecents(d.recipients)).catch(() => {})
  }, [toast])

  const digits = to.replace(/\s/g, "")
  useEffect(() => {
    setRecipient(null)
    if (digits.length !== 12) return
    let stale = false
    api.lookup(digits).then((r) => !stale && setRecipient(r)).catch((e) => !stale && setRecipient({ error: e.message }))
    return () => { stale = true }
  }, [digits])

  const source = accounts?.find((a) => a._id === from)
  const validAmount = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0
  const minor = validAmount ? Math.round(Number(amount) * 100) : 0
  const over = source && minor > source.balance
  const sameAccount = source && digits === source.accountNumber
  const ready = validAmount && !over && recipient?.holder && !sameAccount

  async function confirm() {
    setError(""); setBusy(true)
    try {
      const r = await api.transfer({ fromAccount: from, toAccount: digits, amount, note, idempotencyKey: key.current })
      setReceipt({ id: r.transaction._id, amount: r.transaction.amount, to: digits, holder: recipient.holder, from: source.accountNumber, note, at: new Date().toISOString() })
      key.current = crypto.randomUUID()
      setStep("done")
    } catch (err) {
      setError(err.message)
      if (err.status >= 400 && err.status < 500) key.current = crypto.randomUUID() // definite answer: this attempt is over
      setStep("details")
    } finally { setBusy(false) }
  }
  function again() { setTo(""); setAmount(""); setNote(""); setError(""); setReceipt(null); setStep("details"); api.accounts().then((d) => setAccounts(d.accounts.filter((a) => a.status === "ACTIVE"))) }

  if (!accounts) return <div className="narrow"><div className="skel panel-skel" /></div>
  if (!accounts.length) return <div className="narrow panel pad"><p>You need an active account to send money.</p><Link className="btn" to="/">Go to accounts</Link></div>

  if (step === "done") return (
    <div className="narrow">
      <div className="panel receipt">
        <svg className="tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27l8 8 15-17" /></svg>
        <h1>{money(receipt.amount)} sent</h1>
        <p className="muted">to {receipt.holder}</p>
        <dl>
          <dt>To account</dt><dd className="num">{groupNumber(receipt.to)}</dd>
          <dt>From account</dt><dd className="num">{groupNumber(receipt.from)}</dd>
          {receipt.note && <><dt>Note</dt><dd>{receipt.note}</dd></>}
          <dt>When</dt><dd>{when(receipt.at)}</dd>
          <dt>Reference</dt><dd className="num">{receipt.id.slice(-10).toUpperCase()}</dd>
        </dl>
        <div className="btn-row noprint">
          <button className="btn" onClick={again}>Send another</button>
          <Link className="btn ghost" to={`/accounts/${from}`}>View statement</Link>
          <button className="btn ghost" onClick={() => window.print()}><Icon name="print" size={18} />Print</button>
        </div>
      </div>
    </div>
  )

  if (step === "review") return (
    <div className="narrow">
      <button className="link back" onClick={() => setStep("details")}><Icon name="back" size={16} />Edit</button>
      <h1>Review and confirm</h1>
      <div className="panel review">
        <p className="muted">You’re sending</p>
        <p className="big num">{money(minor)}</p>
        <dl>
          <dt>To</dt><dd>{recipient.holder}<br /><span className="muted num">{groupNumber(digits)}</span></dd>
          <dt>From</dt><dd className="num">••{last4(source.accountNumber)} · balance {money(source.balance)}</dd>
          {note && <><dt>Note</dt><dd>{note}</dd></>}
          <dt>After sending</dt><dd className="num">{money(source.balance - minor)} remaining</dd>
        </dl>
        {error && <p className="alert bad" role="alert">{error}</p>}
        <button className="btn block" onClick={confirm} disabled={busy}>{busy ? "Sending…" : `Confirm and send ${money(minor)}`}</button>
      </div>
    </div>
  )

  return (
    <div className="narrow">
      <h1>Send money</h1>
      {error && <p className="alert bad" role="alert">{error}</p>}
      <form className="panel form" onSubmit={(e) => { e.preventDefault(); setError(""); setStep("review") }}>
        <label>From
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            {accounts.map((a) => <option key={a._id} value={a._id}>••{last4(a.accountNumber)} — {money(a.balance)}</option>)}
          </select>
        </label>

        <label>To account number
          <input value={to} onChange={(e) => setTo(e.target.value.replace(/[^\d\s]/g, ""))} inputMode="numeric" placeholder="12-digit account number" required />
          {recipient?.holder && <small className="ok"><Icon name="check" size={14} /> {recipient.holder}</small>}
          {recipient?.error && <small className="bad">{recipient.error}</small>}
          {sameAccount && <small className="bad">That’s the account you’re sending from</small>}
        </label>
        {recents.length > 0 && (
          <div className="chips" aria-label="Recent recipients">
            {recents.map((r) => <button type="button" key={r.accountNumber} className="chip-btn" onClick={() => setTo(r.accountNumber)}><span className="avatar sm">{r.holder[0]}</span>{r.holder}</button>)}
          </div>
        )}

        <label>Amount
          <span className="amount-input"><span>₹</span><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" required aria-label="Amount in rupees" /></span>
          {over ? <small className="bad">More than your available {money(source.balance)}</small> : source && <small className="muted">Available {money(source.balance)}</small>}
        </label>
        <div className="chips">{QUICK.map((q) => <button type="button" key={q} className="chip-btn" onClick={() => setAmount(String(q))}>₹{q.toLocaleString("en-IN")}</button>)}</div>

        <label>Note <span className="muted">(optional)</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} /></label>
        <button className="btn block" disabled={!ready}>Review</button>
      </form>
    </div>
  )
}
