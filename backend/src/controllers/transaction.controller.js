const mongoose = require("mongoose")
const accountModel = require("../models/account.model")
const transactionModel = require("../models/transaction.model")
const { transfer } = require("../services/ledger.service")
const emailService = require("../services/email.service")
const { toMinor } = require("../utils/money")
const ApiError = require("../utils/ApiError")

const DEMO_MAX_MINOR = 50_000_00 // ₹50,000 per demo top-up

function readCommon(body) {
    const { idempotencyKey } = body
    if (typeof idempotencyKey !== "string" || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
        throw new ApiError(400, "idempotencyKey is required (8-100 chars). Generate a UUID per submit.")
    }
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 140) : undefined
    return { idempotencyKey, note, amount: toMinor(body.amount) }
}

// Accepts a 12-digit account number (UI) or an ObjectId (API).
async function resolveAccount(identifier, label) {
    const id = String(identifier ?? "")
    let account = null
    if (/^\d{12}$/.test(id)) account = await accountModel.findOne({ accountNumber: id })
    else if (mongoose.isValidObjectId(id)) account = await accountModel.findById(id)
    if (!account) throw new ApiError(404, `${label} account not found`)
    return account
}

function replyFor({ transaction, replayed }, res, createdMessage) {
    if (transaction.status === "FAILED") {
        return res.status(409).json({ message: `This request previously failed (${transaction.failureReason}). Retry with a new idempotencyKey.` })
    }
    res.status(replayed ? 200 : 201).json({ message: replayed ? "Transaction already processed" : createdMessage, transaction })
}

async function createTransaction(req, res) {
    const { idempotencyKey, note, amount } = readCommon(req.body)
    const from = await resolveAccount(req.body.fromAccount, "Source")
    const to = await resolveAccount(req.body.toAccount, "Destination")
    // The original code never checked this: any user could spend from ANY account.
    if (String(from.user) !== String(req.user._id)) throw new ApiError(403, "You can only send from your own accounts")

    const result = await transfer({ fromAccountId: from._id, toAccountId: to._id, amount, idempotencyKey, initiatedBy: req.user._id, note })
    if (!result.replayed) emailService.sendTransactionEmail(req.user.email, req.user.name, amount, to.accountNumber)
    replyFor(result, res, "Transfer completed")
}

// System user funds any account from its own account.
async function createInitialFundsTransaction(req, res) {
    const { idempotencyKey, note, amount } = readCommon(req.body)
    const to = await resolveAccount(req.body.toAccount, "Destination")
    const from = await accountModel.findOne({ user: req.user._id, status: "ACTIVE" })
    if (!from) throw new ApiError(400, "System user has no active account (run `npm run seed`)")
    const result = await transfer({ fromAccountId: from._id, toAccountId: to._id, amount, idempotencyKey, initiatedBy: req.user._id, note, type: "FUNDING", skipBalanceCheck: true })
    replyFor(result, res, "Funds added")
}

// Dev/demo convenience: a logged-in user tops up their OWN account from the seeded system account.
async function demoFunds(req, res) {
    if (process.env.ALLOW_DEMO_FUNDS !== "true") throw new ApiError(403, "Demo funds are disabled")
    const { idempotencyKey, amount } = readCommon(req.body)
    if (amount > DEMO_MAX_MINOR) throw new ApiError(400, "Demo top-ups are limited to ₹50,000")
    const to = await resolveAccount(req.body.toAccount, "Destination")
    if (String(to.user) !== String(req.user._id)) throw new ApiError(403, "You can only fund your own accounts")

    const systemUserModel = require("../models/user.model")
    const sys = await systemUserModel.findOne({ email: process.env.SYSTEM_EMAIL?.toLowerCase() })
    const from = sys && await accountModel.findOne({ user: sys._id, status: "ACTIVE" })
    if (!from) throw new ApiError(503, "System account missing (run `npm run seed`)")

    // initiatedBy = the real user so the idempotency key is scoped to them.
    const result = await transfer({ fromAccountId: from._id, toAccountId: to._id, amount, idempotencyKey, initiatedBy: req.user._id, note: "Demo top-up", type: "FUNDING", skipBalanceCheck: true })
    replyFor(result, res, "Demo funds added")
}

// Transactions touching any of the user's accounts.
async function listTransactions(req, res) {
    const mine = await accountModel.find({ user: req.user._id }).distinct("_id")
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)
    const txns = await transactionModel.find({ $or: [{ fromAccount: { $in: mine } }, { toAccount: { $in: mine } }] })
        .sort({ _id: -1 }).limit(limit)
        .populate("fromAccount toAccount", "accountNumber")
    res.json({ transactions: txns })
}

module.exports = { createTransaction, createInitialFundsTransaction, demoFunds, listTransactions }
