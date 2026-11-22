const ledgerModel = require("../models/ledger.model")
const accountModel = require("../models/account.model")
const { sendMail, esc } = require("./email.service")
const { formatINR } = require("../utils/money")
const { addDays, dayStart } = require("../utils/tz")

const MAX_ROWS = 20000
const SIGNED = { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", { $multiply: ["$amount", -1] }] }

/** Statement for [fromDay, toDay] inclusive (YYYY-MM-DD in the business timezone), with a running balance. */
async function buildStatement(account, fromDay, toDay) {
    const from = dayStart(fromDay), toExclusive = dayStart(addDays(toDay, 1))
    const [pre] = await ledgerModel.aggregate([
        { $match: { account: account._id, createdAt: { $lt: from } } },
        { $group: { _id: null, net: { $sum: SIGNED } } }
    ])
    const opening = pre?.net ?? 0

    const entries = await ledgerModel.find({ account: account._id, createdAt: { $gte: from, $lt: toExclusive } })
        .sort({ _id: 1 }).limit(MAX_ROWS + 1)
        .populate({ path: "transaction", select: "type note fromAccount toAccount", populate: [{ path: "fromAccount", select: "accountNumber" }, { path: "toAccount", select: "accountNumber" }] })
        .lean()
    const truncated = entries.length > MAX_ROWS
    if (truncated) entries.pop()

    let running = opening, totalDebit = 0, totalCredit = 0
    const rows = entries.map((e) => {
        const t = e.transaction
        const debit = e.type === "DEBIT"
        running += debit ? -e.amount : e.amount
        debit ? (totalDebit += e.amount) : (totalCredit += e.amount)
        const other = debit ? t?.toAccount?.accountNumber : t?.fromAccount?.accountNumber
        let description
        if (t?.type === "FUNDING") description = t.note || "Funds added"
        else if (t?.type === "REVERSAL") description = `Reversal ${debit ? "to" : "from"} ${other ?? "unknown"}`
        else description = `${debit ? "Sent to" : "Received from"} ${other ?? "unknown"}${t?.note ? ` - ${t.note}` : ""}`
        return { date: e.createdAt, description, reference: String(e.transaction?._id ?? t?._id ?? ""), debit: debit ? e.amount : 0, credit: debit ? 0 : e.amount, balance: running }
    })
    return { account, fromDay, toDay, opening, closing: running, totalDebit, totalCredit, rows, truncated }
}

// CSV: quote when needed AND neutralise spreadsheet formula injection (=, +, -, @ at the start of a text cell).
function csvCell(v) {
    let s = String(v ?? "")
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const rupees = (minor) => (minor / 100).toFixed(2)

function toCsv(st, tzOffset) {
    const lines = [["Date", "Time", "Description", "Reference", "Debit (INR)", "Credit (INR)", "Balance (INR)"]]
    lines.push(["", "", "Opening balance", "", "", "", rupees(st.opening)])
    for (const r of st.rows) {
        const local = new Date(r.date.getTime() + tzMinutes(tzOffset) * 60000).toISOString()
        lines.push([local.slice(0, 10), local.slice(11, 19), r.description, r.reference, r.debit ? rupees(r.debit) : "", r.credit ? rupees(r.credit) : "", rupees(r.balance)])
    }
    lines.push(["", "", "Closing balance", "", rupees(st.totalDebit), rupees(st.totalCredit), rupees(st.closing)])
    return "\uFEFF" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n"
}
function tzMinutes(o) { const m = /^([+-])(\d{2}):(\d{2})$/.exec(o); return (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3]) }

/** Emails statements (CSV attached) for the user's accounts. true = sent or nothing to send; false = failed. */
async function emailStatements(user, fromDay, toDay, { accountId } = {}) {
    const { OFFSET } = require("../utils/tz")
    const filter = { user: user._id, status: { $ne: "CLOSED" }, ...(accountId && { _id: accountId }) }
    const accounts = await accountModel.find(filter).sort({ createdAt: 1 })
    const statements = []
    for (const a of accounts) statements.push(await buildStatement(a, fromDay, toDay))
    const active = statements.filter((s) => s.rows.length || accountId)
    if (!active.length) return true

    const rowsHtml = active.map((s) => `<tr><td>${esc(s.account.accountNumber)}</td><td align="right">${esc(formatINR(s.opening))}</td><td align="right">${esc(formatINR(s.totalCredit))}</td><td align="right">${esc(formatINR(s.totalDebit))}</td><td align="right"><b>${esc(formatINR(s.closing))}</b></td></tr>`).join("")
    const html = `<p>Hello ${esc(user.name)},</p><p>Your statement for <b>${fromDay}</b> to <b>${toDay}</b> is attached as CSV.</p>
<table cellpadding="6" style="border-collapse:collapse"><tr><th align="left">Account</th><th align="right">Opening</th><th align="right">Credits</th><th align="right">Debits</th><th align="right">Closing</th></tr>${rowsHtml}</table>
<p style="color:#666;font-size:12px">You receive this because you turned on statement emails. Change it any time in Settings.</p>`
    return sendMail({
        to: user.email, subject: `Your Ledger Bank statement, ${fromDay} to ${toDay}`,
        text: `Your statement for ${fromDay} to ${toDay} is attached.`, html,
        attachments: active.map((s) => ({ filename: `statement-${s.account.accountNumber}-${fromDay}-${toDay}.csv`, content: toCsv(s, OFFSET), contentType: "text/csv" }))
    })
}

module.exports = { buildStatement, toCsv, csvCell, emailStatements }
