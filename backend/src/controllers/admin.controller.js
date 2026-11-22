const mongoose = require("mongoose")
const accountModel = require("../models/account.model")
const transactionModel = require("../models/transaction.model")
const userModel = require("../models/user.model")
const { getBalances, transfer, reconcile } = require("../services/ledger.service")
const ApiError = require("../utils/ApiError")

async function stats(req, res) {
    const [users, accounts, byStatus] = await Promise.all([
        userModel.countDocuments(), accountModel.countDocuments(),
        transactionModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 }, volume: { $sum: "$amount" } } }])
    ])
    res.json({ users, accounts, transactions: byStatus })
}

async function listAccounts(req, res) {
    const accounts = await accountModel.find().sort({ createdAt: -1 }).limit(200).populate("user", "name email")
    const balances = await getBalances(accounts.map((a) => a._id))
    res.json({
        accounts: accounts.map((a, i) => ({
            _id: a._id, accountNumber: a.accountNumber, status: a.status, balance: balances[i],
            owner: a.user && { name: a.user.name, email: a.user.email }
        }))
    })
}

async function setAccountStatus(req, res) {
    const { status } = req.body
    if (!["ACTIVE", "FROZEN", "CLOSED"].includes(status)) throw new ApiError(400, "status must be ACTIVE, FROZEN or CLOSED")
    if (!mongoose.isValidObjectId(req.params.accountId)) throw new ApiError(400, "Invalid account id")
    const account = await accountModel.findById(req.params.accountId)
    if (!account) throw new ApiError(404, "Account not found")
    if (account.status === "CLOSED") throw new ApiError(422, "A closed account cannot be reopened")
    if (status === "CLOSED") {
        const [balance] = await getBalances([account._id])
        if (balance !== 0) throw new ApiError(422, "Only accounts with a zero balance can be closed", { balance })
    }
    account.status = status
    await account.save()
    res.json({ account: { _id: account._id, status: account.status } })
}

async function listTransactions(req, res) {
    const filter = {}
    if (req.query.status) filter.status = String(req.query.status).toUpperCase()
    const transactions = await transactionModel.find(filter).sort({ _id: -1 }).limit(100)
        .populate("fromAccount toAccount", "accountNumber")
    res.json({ transactions })
}

async function reverseTransaction(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, "Invalid transaction id")
    const original = await transactionModel.findById(req.params.id)
    if (!original) throw new ApiError(404, "Transaction not found")
    if (original.type === "REVERSAL") throw new ApiError(422, "A reversal cannot itself be reversed")
    if (original.status !== "COMPLETED") throw new ApiError(409, `Only COMPLETED transactions can be reversed (this one is ${original.status})`)

    // Money goes back the opposite way. Key is derived from the original, so a double-click can't reverse twice.
    const result = await transfer({
        fromAccountId: original.toAccount, toAccountId: original.fromAccount, amount: original.amount,
        idempotencyKey: `reversal:${original._id}`, initiatedBy: req.user._id,
        type: "REVERSAL", reversalOf: original._id, note: `Reversal of ${original._id}`
    })
    res.status(result.replayed ? 200 : 201).json({ message: "Transaction reversed", transaction: result.transaction })
}

async function reconcileController(req, res) {
    res.json(await reconcile({ fix: false }))
}

module.exports = { reconcileController, stats, listAccounts, setAccountStatus, listTransactions, reverseTransaction }
