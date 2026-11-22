const mongoose = require("mongoose")

const ledgerSchema = new mongoose.Schema({
    account: { type: mongoose.Schema.Types.ObjectId, ref: "account", required: true, index: true, immutable: true },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: "transaction", required: true, index: true, immutable: true },
    type: { type: String, enum: ["CREDIT", "DEBIT"], required: true, immutable: true },
    amount: {
        type: Number, required: true, immutable: true, min: 1,
        validate: { validator: Number.isInteger, message: "Amount must be an integer number of paise" }
    }
}, { timestamps: { createdAt: true, updatedAt: false } })

ledgerSchema.index({ account: 1, _id: -1 })

// Append-only: block every way of changing or removing an entry.
function blocked() { throw new Error("Ledger entries are immutable and cannot be modified or deleted") }
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne",
    "findOneAndDelete", "deleteMany"]) ledgerSchema.pre(op, blocked)
ledgerSchema.pre("deleteOne", { document: true, query: true }, blocked)
ledgerSchema.pre("save", function () { if (!this.isNew) blocked() })

module.exports = mongoose.model("ledger", ledgerSchema)
