import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { api } from "../api"
import { useToast } from "../toast.jsx"
import { daysAgo, groupNumber, localDay, dayLabel, money } from "../format"
import Icon from "../components/Icon.jsx"
import CountUp from "../components/CountUp.jsx"
import { EntryRow } from "./Dashboard.jsx"

const RANGES = [["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["365", "1 year"]]
const TYPES = [["", "All"], ["CREDIT", "Money in"], ["DEBIT", "Money out"]]

export default function Statement() {
  const { id } = useParams()
  const toast = useToast()
  const [account, setAccount] = useState(null)
  const [range, setRange] = useState("30")
  const [type, setType] = useState("")
  const [entries, setEntries] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [more, setMore] = useState(false)
  const [emailing, setEmailing] = useState(false)

  const from = daysAgo(Number(range) - 1), to = localDay()

  useEffect(() => { api.accounts().then((d) => setAccount(d.accounts.find((a) => a._id === id))).catch((e) => toast.error(e.message)) }, [id, toast])

  const fetchPage = useCallback(async (before) => {
    try {
      const d = await api.ledger(id, { from, to, type, before, limit: 30 })
      setEntries((prev) => (before ? [...(prev ?? []), ...d.entries] : d.entries))
      setCursor(d.nextCursor)
    } catch (e) { toast.error(e.message) } finally { setMore(false) }
  }, [id, from, to, type, toast])
  useEffect(() => { setEntries(null); fetchPage() }, [fetchPage])

  const groups = useMemo(() => {
    const out = []
    for (const e of entries ?? []) {
      const label = dayLabel(e.createdAt)
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] })
      out[out.length - 1].items.push(e)
    }
    return out
  }, [entries])

  async function emailMe() {
    setEmailing(true)
    try { toast.success((await api.emailStatement(id, { from, to })).message) } catch (e) { toast.error(e.message) } finally { setEmailing(false) }
  }

  return (
    <>
      <Link className="link back" to="/"><Icon name="back" size={16} />All accounts</Link>
      <div className="page-head">
        <div>
          <h1>Statement</h1>
          {account && <p className="muted num">Account {groupNumber(account.accountNumber)}</p>}
        </div>
        {account && <div className="bal-block"><span className="muted">Balance</span><strong><CountUp value={account.balance} /></strong></div>}
      </div>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Period">
          {RANGES.map(([v, l]) => <button key={v} className={range === v ? "on" : ""} onClick={() => setRange(v)}>{l}</button>)}
        </div>
        <div className="seg" role="group" aria-label="Type">
          {TYPES.map(([v, l]) => <button key={v} className={type === v ? "on" : ""} onClick={() => setType(v)}>{l}</button>)}
        </div>
        <span className="spacer" />
        <a className="btn ghost sm" href={api.csvUrl(id, from, to)} download><Icon name="download" size={16} />CSV</a>
        <button className="btn ghost sm" onClick={emailMe} disabled={emailing}><Icon name="mail" size={16} />{emailing ? "Sending…" : "Email me"}</button>
      </div>

      <div className="panel">
        {!entries && [0, 1, 2, 3].map((i) => <div key={i} className="row"><span className="skel w-100 h-20" /></div>)}
        {entries?.length === 0 && <p className="muted pad">Nothing in this period.</p>}
        {groups.map((g) => (
          <div key={g.label}>
            <div className="day">{g.label}</div>
            {g.items.map((e) => <EntryRow key={e._id} e={e} showDay />)}
          </div>
        ))}
      </div>
      {cursor && <button className="btn ghost center-btn" disabled={more} onClick={() => { setMore(true); fetchPage(cursor) }}>{more ? "Loading…" : "Load older entries"}</button>}
    </>
  )
}
