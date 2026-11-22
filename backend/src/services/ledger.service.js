const mongoose = require("mongoose")
const accountModel = require("../models/account.model")
const ledgerModel = require("../models/ledger.model")
const transactionModel = require("../models/transaction.model")
const ApiError = require("../utils/ApiError")

/** O(1) per account: read the materialised balance (paise). */
async function getBalances(accountIds) {
    const rows = await accountModel.find({ _id: { $in: accountIds } }).select("balance").lean()
    const map = new Map(rows.map((r) => [String(r._id), r.balance ?? 0]))
    return accountIds.map((id) => map.get(String(id)) ?? 0)
}
const getBalance = async (id) => (await getBalances([id]))[0]

const SIGNED = { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", { $multiply: ["$amount", -1] }] }

/**
 * Proves the materialised balances equal the sum of the immutable ledger.
 * fix=true rewrites mismatches from the ledger (run in a quiet period).
 */
async function reconcile({ fix = false } = {}) {
    const sums = await ledgerModel.aggregate([{ $group: { _id: "$account", balance: { $sum: SIGNED } } }])
    const expectedBy = new Map(sums.map((r) => [String(r._id), r.balance]))
    const mismatches = []
    let checked = 0
    for await (const a of accountModel.find().select("balance accountNumber").lean().cursor()) {
        checked++
        const expected = expectedBy.get(String(a._id)) ?? 0
        if (a.balance !== expected) {
            mismatches.push({ accountId: a._id, accountNumber: a.accountNumber, stored: a.balance ?? null, expected })
            if (fix) await accountModel.updateOne({ _id: a._id }, { $set: { balance: expected } })
        }
    }
    return { checked, mismatches, fixed: fix ? mismatches.length : 0 }
}

async function explainDebitFailure(accountId, session) {
    const acc = await accountModel.findById(accountId).session(session)
    if (!acc) return new ApiError(404, "Account not found")
    if (acc.status !== "ACTIVE") return new ApiError(422, "Source account is not active")
    return new ApiError(422, "Insufficient balance", { balance: acc.balance })
}

/**
 * Atomic double-entry transfer.
 *  - One MongoDB transaction: balance debit + credit + transaction record + 2 ledger entries commit together or not at all.
 *  - The debit is a single conditional update ({balance >= amount}), so overdrafts are impossible even under
 *    concurrency; competing writers conflict and the loser retries against the new balance.
 *  - Idempotent per (user, idempotencyKey).
 *  - skipBalanceCheck is only for the system funding account (allowed to go negative: it is the money source).
 */
async function transfer({ fromAccountId, toAccountId, amount, idempotencyKey, initiatedBy, note, type = "TRANSFER", skipBalanceCheck = false, reversalOf = null }) {
    if (String(fromAccountId) === String(toAccountId)) throw new ApiError(400, "Cannot transfer to the same account")

    const existing = await findByKey(initiatedBy, idempotencyKey)
    if (existing) return { transaction: existing, replayed: true }

    const session = await mongoose.startSession()
    try {
        let result
        await session.withTransaction(async () => {
            result = null
            const again = await transactionModel.findOne({ initiatedBy, idempotencyKey }).session(session)
            if (again) { result = { transaction: again, replayed: true }; return }

            const debitFilter = { _id: fromAccountId, status: "ACTIVE", ...(skipBalanceCheck ? {} : { balance: { $gte: amount } }) }
            const from = await accountModel.findOneAndUpdate(debitFilter, { $inc: { balance: -amount } }, { session, new: true })
            if (!from) throw await explainDebitFailure(fromAccountId, session)

            const to = await accountModel.findOneAndUpdate({ _id: toAccountId, status: "ACTIVE" }, { $inc: { balance: amount } }, { session, new: true })
            if (!to) {
                const exists = await accountModel.exists({ _id: toAccountId }).session(session)
                throw exists ? new ApiError(422, "Destination account is not active") : new ApiError(404, "Account not found")
            }

            if (reversalOf) {
                // Flip the original COMPLETED -> REVERSED atomically; only one reversal can ever win.
                const r = await transactionModel.updateOne({ _id: reversalOf, status: "COMPLETED" }, { status: "REVERSED" }, { session })
                if (r.modifiedCount !== 1) throw new ApiError(409, "Transaction is not in a reversible state")
            }
            const [txn] = await transactionModel.create([{
                fromAccount: from._id, toAccount: to._id, initiatedBy, amount, note, type, idempotencyKey, status: "COMPLETED",
                ...(reversalOf && { reversalOf })
            }], { session })
            await ledgerModel.create([
                { account: from._id, transaction: txn._id, type: "DEBIT", amount },
                { account: to._id, transaction: txn._id, type: "CREDIT", amount }
            ], { session, ordered: true })

            result = { transaction: txn, replayed: false, toAccountNumber: to.accountNumber }
        })
        return result
    } catch (err) {
        if (err.code === 11000) { // concurrent duplicate that lost the unique-index race
            const dup = await findByKey(initiatedBy, idempotencyKey)
            if (dup) return { transaction: dup, replayed: true }
        }
        if (err instanceof ApiError && err.status === 422 && !reversalOf) { // audit trail for business failures
            await transactionModel.create({
                fromAccount: fromAccountId, toAccount: toAccountId, initiatedBy, amount, note, type, idempotencyKey,
                status: "FAILED", failureReason: err.message
            }).catch(() => {})
        }
        throw err
    } finally {
        session.endSession()
    }
}

const findByKey = (initiatedBy, idempotencyKey) => transactionModel.findOne({ initiatedBy, idempotencyKey })

module.exports = { getBalance, getBalances, transfer, reconcile }
