const mongoose = require("mongoose")
const accountModel = require("../models/account.model")
const ledgerModel = require("../models/ledger.model")
const transactionModel = require("../models/transaction.model")
const { getBalances, getBalance } = require("../services/ledger.service")
const { buildStatement, toCsv, emailStatements } = require("../services/statement.service")
const { isEmailEnabled } = require("../services/email.service")
const { OFFSET, dayString, addDays, dayStart, isDay } = require("../utils/tz")
const ApiError = require("../utils/ApiError")

const MAX_ACCOUNTS_PER_USER = 5
const shape = (a, balance) => ({ _id: a._id, accountNumber: a.accountNumber, status: a.status, currency: a.currency, createdAt: a.createdAt, balance })
const maskName = (name) => name.split(" ").map((w, i) => (i === 0 ? w[0] + "***" : w[0] + ".")).join(" ")

async function ownedAccount(id, userId) {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(400, "Invalid account id")
    const account = await accountModel.findOne({ _id: id, user: userId })
    if (!account) throw new ApiError(404, "Account not found")
    return account
}

function dateRange(q, defaultDays = 30) {
    const today = dayString()
    const to = q.to || today
    const from = q.from || addDays(to, -(defaultDays - 1))
    if (!isDay(from) || !isDay(to)) throw new ApiError(400, "Dates must be YYYY-MM-DD")
    if (from > to) throw new ApiError(400, "'from' must not be after 'to'")
    if (Date.parse(to) - Date.parse(from) > 366 * 864e5) throw new ApiError(400, "Range is limited to 366 days")
    return { from, to }
}

async function createAccountController(req, res) {
    if ((await accountModel.countDocuments({ user: req.user._id, status: { $ne: "CLOSED" } })) >= MAX_ACCOUNTS_PER_USER) {
        throw new ApiError(422, `You can have at most ${MAX_ACCOUNTS_PER_USER} accounts`)
    }
    const account = await accountModel.create({ user: req.user._id })
    res.status(201).json({ account: shape(account, 0) })
}

async function getUserAccountsController(req, res) {
    const accounts = await accountModel.find({ user: req.user._id }).sort({ createdAt: 1 })
    res.json({ accounts: accounts.map((a) => shape(a, a.balance ?? 0)) })
}

async function getAccountBalanceController(req, res) {
    const account = await ownedAccount(req.params.accountId, req.user._id)
    res.json({ accountId: account._id, balance: await getBalance(account._id) })
}

async function lookupAccountController(req, res) {
    const { accountNumber } = req.params
    if (!/^\d{12}$/.test(accountNumber)) throw new ApiError(400, "Account number must be 12 digits")
    const account = await accountModel.findOne({ accountNumber }).populate("user", "name")
    if (!account || account.status !== "ACTIVE") throw new ApiError(404, "No active account with that number")
    res.json({ accountNumber, holder: maskName(account.user.name) })
}

// People you have paid before (masked), newest first.
async function recentRecipientsController(req, res) {
    const mine = await accountModel.find({ user: req.user._id }).distinct("_id")
    const txns = await transactionModel.find({ fromAccount: { $in: mine }, type: "TRANSFER", status: "COMPLETED" })
        .sort({ _id: -1 }).limit(40).populate({ path: "toAccount", select: "accountNumber user", populate: { path: "user", select: "name" } })
    const seen = new Set(), recipients = []
    for (const t of txns) {
        const a = t.toAccount
        if (!a || seen.has(a.accountNumber) || mine.some((id) => String(id) === String(a._id))) continue
        seen.add(a.accountNumber)
        recipients.push({ accountNumber: a.accountNumber, holder: maskName(a.user.name) })
        if (recipients.length === 5) break
    }
    res.json({ recipients })
}

// Statement list: newest first, cursor-paginated, optional type/date filters.
async function getAccountLedgerController(req, res) {
    const account = await ownedAccount(req.params.accountId, req.user._id)
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const filter = { account: account._id }
    if (req.query.type) {
        if (!["CREDIT", "DEBIT"].includes(req.query.type)) throw new ApiError(400, "type must be CREDIT or DEBIT")
        filter.type = req.query.type
    }
    if (req.query.from || req.query.to) {
        const { from, to } = dateRange(req.query, 3650)
        filter.createdAt = { $gte: dayStart(from), $lt: dayStart(addDays(to, 1)) }
    }
    if (req.query.before) {
        if (!mongoose.isValidObjectId(req.query.before)) throw new ApiError(400, "Invalid cursor")
        filter._id = { $lt: req.query.before }
    }
    const rows = await ledgerModel.find(filter).sort({ _id: -1 }).limit(limit + 1).populate({
        path: "transaction", select: "type note status fromAccount toAccount",
        populate: [{ path: "fromAccount", select: "accountNumber" }, { path: "toAccount", select: "accountNumber" }]
    })
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)
    res.json({
        entries: page.map((r) => {
            const t = r.transaction
            const counterparty = r.type === "DEBIT" ? t?.toAccount?.accountNumber : t?.fromAccount?.accountNumber
            return { _id: r._id, type: r.type, amount: r.amount, createdAt: r.createdAt, transactionId: t?._id, kind: t?.type, note: t?.note, counterparty }
        }),
        nextCursor: hasMore ? page[page.length - 1]._id : null
    })
}

// Daily closing balance + inflow/outflow for charts. Walks backwards from the current balance.
async function getAccountHistoryController(req, res) {
    const account = await ownedAccount(req.params.accountId, req.user._id)
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 7), 365)
    const today = dayString()
    const first = addDays(today, -(days - 1))
    const rows = await ledgerModel.aggregate([
        { $match: { account: account._id, createdAt: { $gte: dayStart(first) } } },
        { $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: OFFSET } },
            credit: { $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0] } },
            debit: { $sum: { $cond: [{ $eq: ["$type", "DEBIT"] }, "$amount", 0] } }
        } }
    ])
    const byDay = new Map(rows.map((r) => [r._id, r]))
    const points = []
    let balance = account.balance ?? 0
    for (let i = days - 1; i >= 0; i--) {
        const date = addDays(today, -(days - 1 - i))
        const d = byDay.get(date)
        points[days - 1 - i] = { date, credit: d?.credit ?? 0, debit: d?.debit ?? 0 }
    }
    for (let i = points.length - 1; i >= 0; i--) {
        points[i].balance = balance
        balance -= points[i].credit - points[i].debit
    }
    res.json({ points, openingBalance: balance })
}

async function downloadStatementCsvController(req, res) {
    const account = await ownedAccount(req.params.accountId, req.user._id)
    const { from, to } = dateRange(req.query)
    const st = await buildStatement(account, from, to)
    res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="statement-${account.accountNumber}-${from}-${to}.csv"`,
        "Cache-Control": "no-store",
        ...(st.truncated && { "X-Statement-Truncated": "true" })
    })
    res.send(toCsv(st, OFFSET))
}

async function emailStatementController(req, res) {
    if (!isEmailEnabled()) throw new ApiError(503, "Email is not configured on this server")
    const account = await ownedAccount(req.params.accountId, req.user._id)
    const { from, to } = dateRange(req.body ?? {})
    if (!(await emailStatements(req.user, from, to, { accountId: account._id }))) throw new ApiError(502, "Could not send the email. Try again later.")
    res.json({ message: `Statement sent to ${req.user.email}` })
}

module.exports = {
    createAccountController, getUserAccountsController, getAccountBalanceController, lookupAccountController,
    recentRecipientsController, getAccountLedgerController, getAccountHistoryController, downloadStatementCsvController, emailStatementController
}
