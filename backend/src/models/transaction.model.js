const mongoose = require("mongoose")

const transactionSchema = new mongoose.Schema({
    fromAccount: { type: mongoose.Schema.Types.ObjectId, ref: "account", required: true, index: true },
    toAccount: { type: mongoose.Schema.Types.ObjectId, ref: "account", required: true, index: true },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    type: { type: String, enum: ["TRANSFER", "FUNDING", "REVERSAL"], default: "TRANSFER" },
    status: { type: String, enum: ["PENDING", "COMPLETED", "FAILED", "REVERSED"], default: "COMPLETED" },
    amount: { type: Number, required: true, min: 1 }, // paise
    note: { type: String, trim: true, maxlength: 140 },
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "transaction", unique: true, sparse: true },
    failureReason: String,
    idempotencyKey: { type: String, required: true }
}, { timestamps: true })

// Keys are scoped per user, so one user can never collide with / probe another's.
transactionSchema.index({ initiatedBy: 1, idempotencyKey: 1 }, { unique: true })

module.exports = mongoose.model("transaction", transactionSchema)
