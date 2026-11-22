import { useCallback, useEffect, useState } from "react"
import { api } from "../api"
import { useToast } from "../toast.jsx"
import { groupNumber, money, when } from "../format"

export default function Admin() {
  const toast = useToast()
  const [tab, setTab] = useState("transactions")
  const [stats, setStats] = useState(null)
  const [txns, setTxns] = useState([])
  const [accounts, setAccounts] = useState([])
  const [recon, setRecon] = useState(null)

  const load = useCallback(async () => {
    try {
      const [s, t, a] = await Promise.all([api.admin.stats(), api.admin.transactions(), api.admin.accounts()])
      setStats(s); setTxns(t.transactions); setAccounts(a.accounts)
    } catch (e) { toast.error(e.message) }
  }, [toast])
  useEffect(() => { load() }, [load])

  async function act(fn, done) { try { await fn(); toast.success(done); await load() } catch (e) { toast.error(e.message) } }
  const reverse = (t) => window.confirm(`Reverse ${money(t.amount)} from ${t.fromAccount?.accountNumber} to ${t.toAccount?.accountNumber}? Money moves back.`) && act(() => api.admin.reverse(t._id), "Transaction reversed")
  const count = (s) => stats?.transactions.find((x) => x._id === s)?.count ?? 0
  const runRecon = async () => { try { setRecon(await api.admin.reconcile()) } catch (e) { toast.error(e.message) } }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Administration</h1>
          {stats && <p className="muted">{stats.users} users · {stats.accounts} accounts · {count("COMPLETED")} completed · {count("FAILED")} failed · {count("REVERSED")} reversed</p>}
        </div>
        <div className="seg">
          <button className={tab === "transactions" ? "on" : ""} onClick={() => setTab("transactions")}>Transactions</button>
          <button className={tab === "accounts" ? "on" : ""} onClick={() => setTab("accounts")}>Accounts</button>
          <button className={tab === "integrity" ? "on" : ""} onClick={() => setTab("integrity")}>Integrity</button>
        </div>
      </div>

      {tab === "transactions" && (
        <div className="panel scroll"><table className="tbl">
          <thead><tr><th>When</th><th>From → To</th><th>Type</th><th>Status</th><th className="r">Amount</th><th /></tr></thead>
          <tbody>{txns.map((t) => (
            <tr key={t._id}>
              <td className="muted nowrap">{when(t.createdAt)}</td>
              <td className="num">{groupNumber(t.fromAccount?.accountNumber)} → {groupNumber(t.toAccount?.accountNumber)}</td>
              <td>{t.type.toLowerCase()}</td>
              <td title={t.failureReason}><em className={`chip ${t.status.toLowerCase()}`}>{t.status.toLowerCase()}</em></td>
              <td className="r num">{money(t.amount)}</td>
              <td className="r">{t.status === "COMPLETED" && t.type !== "REVERSAL" && <button className="link" onClick={() => reverse(t)}>Reverse</button>}</td>
            </tr>))}</tbody>
        </table></div>
      )}

      {tab === "accounts" && (
        <div className="panel scroll"><table className="tbl">
          <thead><tr><th>Account</th><th>Owner</th><th>Status</th><th className="r">Balance</th><th /></tr></thead>
          <tbody>{accounts.map((a) => (
            <tr key={a._id}>
              <td className="num">{groupNumber(a.accountNumber)}</td>
              <td>{a.owner?.name}<br /><span className="muted">{a.owner?.email}</span></td>
              <td><em className={`chip ${a.status.toLowerCase()}`}>{a.status.toLowerCase()}</em></td>
              <td className="r num">{money(a.balance)}</td>
              <td className="r actions">
                {a.status === "ACTIVE" && <button className="link" onClick={() => act(() => api.admin.setStatus(a._id, "FROZEN"), "Account frozen")}>Freeze</button>}
                {a.status === "FROZEN" && <button className="link" onClick={() => act(() => api.admin.setStatus(a._id, "ACTIVE"), "Account unfrozen")}>Unfreeze</button>}
                {a.status !== "CLOSED" && <button className="link" onClick={() => window.confirm("Close this account permanently?") && act(() => api.admin.setStatus(a._id, "CLOSED"), "Account closed")}>Close</button>}
              </td>
            </tr>))}</tbody>
        </table></div>
      )}

      {tab === "integrity" && (
        <div className="panel pad">
          <h2>Ledger reconciliation</h2>
          <p className="muted">Checks that every account’s stored balance equals the sum of its immutable ledger entries.</p>
          <button className="btn" onClick={runRecon}>Run check</button>
          {recon && (recon.mismatches.length === 0
            ? <p className="alert ok">All {recon.checked} accounts reconcile. Stored balances match the ledger.</p>
            : <div className="alert bad"><b>{recon.mismatches.length} mismatch(es)</b> in {recon.checked} accounts. Run <code>npm run reconcile -- --fix</code> on the server after investigating.
                <ul>{recon.mismatches.map((m) => <li key={m.accountId} className="num">{m.accountNumber}: stored {m.stored ?? "none"}, ledger {m.expected}</li>)}</ul></div>)}
        </div>
      )}
    </>
  )
}
