// Integration tests. They need a MongoDB REPLICA SET (Atlas free tier works).
// Use a throwaway database:  set MONGO_URI_TEST=... then  npm test
const test = require("node:test")
const assert = require("node:assert")
const mongoose = require("mongoose")

const URI = process.env.MONGO_URI_TEST
const opts = { skip: !URI && "MONGO_URI_TEST not set" }

let User, Account, Ledger, Txn, svc, alice, bob, sys

async function mkUser(name, systemUser = false) {
    const u = await User.create({ name, email: `${name}-${Date.now()}@t.io`.toLowerCase(), password: "password123", systemUser })
    return { user: u, acc: await Account.create({ user: u._id }) }
}
const send = (from, to, amount, key, by) =>
    svc.transfer({ fromAccountId: from.acc._id, toAccountId: to.acc._id, amount, idempotencyKey: key, initiatedBy: by.user._id })
const bal = async (x) => (await svc.getBalance(x.acc._id))

test.before(async () => {
    if (!URI) return
    await mongoose.connect(URI)
    await mongoose.connection.dropDatabase()
    User = require("../src/models/user.model"); Account = require("../src/models/account.model")
    Ledger = require("../src/models/ledger.model"); Txn = require("../src/models/transaction.model")
    svc = require("../src/services/ledger.service")
    ;[alice, bob, sys] = [await mkUser("alice"), await mkUser("bob"), await mkUser("sys", true)]
    await svc.transfer({ fromAccountId: sys.acc._id, toAccountId: alice.acc._id, amount: 100_00, idempotencyKey: "seed-fund-1", initiatedBy: sys.user._id, type: "FUNDING", skipBalanceCheck: true })
})
test.after(async () => { if (URI) { await mongoose.connection.dropDatabase(); await mongoose.disconnect() } })

test("transfer moves money and writes a balanced debit/credit pair", opts, async () => {
    await send(alice, bob, 30_00, "t-basic-001", alice)
    assert.strictEqual(await bal(alice), 70_00)
    assert.strictEqual(await bal(bob), 30_00)
})

test("insufficient funds is rejected and nothing moves", opts, async () => {
    await assert.rejects(send(alice, bob, 999_00, "t-insuf-001", alice), /Insufficient/)
    assert.strictEqual(await bal(alice), 70_00)
})

test("same idempotency key never pays twice", opts, async () => {
    const a = await send(alice, bob, 10_00, "t-idem-0001", alice)
    const b = await send(alice, bob, 10_00, "t-idem-0001", alice)
    assert.strictEqual(String(a.transaction._id), String(b.transaction._id))
    assert.strictEqual(b.replayed, true)
    assert.strictEqual(await bal(alice), 60_00)
})

test("concurrent spends cannot overdraw (no double-spend)", opts, async () => {
    // alice has 60.00; ten parallel 20.00 transfers: at most 3 may succeed
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => send(alice, bob, 20_00, `t-race-${i}-xxxx`, alice)))
    assert.ok(results.filter((r) => r.status === "fulfilled").length <= 3)
    assert.ok((await bal(alice)) >= 0)
})

test("stored balances always equal the sum of the ledger", opts, async () => {
    const r = await svc.reconcile()
    assert.deepStrictEqual(r.mismatches, [])
    assert.ok(r.checked >= 3)
})

test("ledger entries are immutable", opts, async () => {
    const entry = await Ledger.findOne()
    await assert.rejects(Ledger.updateOne({ _id: entry._id }, { amount: 1 }), /immutable/)
    await assert.rejects(Ledger.deleteMany({}), /immutable/)
    entry.amount = 5
    await assert.rejects(entry.save())
})

test("reversal returns the money once, and only once", opts, async () => {
    const { transaction } = await send(bob, alice, 5_00, "t-rev-00001", bob)
    const before = [await bal(alice), await bal(bob)]
    const rev = () => svc.transfer({ fromAccountId: alice.acc._id, toAccountId: bob.acc._id, amount: 5_00, idempotencyKey: `reversal:${transaction._id}`, initiatedBy: sys.user._id, type: "REVERSAL", reversalOf: transaction._id })
    await rev()
    assert.strictEqual(await bal(alice), before[0] - 5_00)
    assert.strictEqual(await bal(bob), before[1] + 5_00)
    assert.strictEqual((await Txn.findById(transaction._id)).status, "REVERSED")
    assert.strictEqual((await rev()).replayed, true) // second attempt moves nothing
    assert.strictEqual(await bal(bob), before[1] + 5_00)
})
