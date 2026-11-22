const mongoose = require("mongoose")
const crypto = require("crypto")

const accountSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    accountNumber: { type: String, unique: true, immutable: true },
    status: { type: String, enum: ["ACTIVE", "FROZEN", "CLOSED"], default: "ACTIVE" },
    currency: { type: String, default: "INR", immutable: true },
    // Materialised balance in paise, updated atomically in the SAME transaction as the ledger entries.
    // The ledger is the source of truth; `npm run reconcile` proves they agree.
    balance: { type: Number, default: 0 }
}, { timestamps: true })

accountSchema.pre("validate", async function () {
    if (this.accountNumber) return
    for (let i = 0; i < 5; i++) {
        const candidate = String(crypto.randomInt(10 ** 11, 10 ** 12)) // 12 digits
        if (!(await this.constructor.exists({ accountNumber: candidate }))) {
            this.accountNumber = candidate
            return
        }
    }
    throw new Error("Could not generate an account number")
})

module.exports = mongoose.model("account", accountSchema)
