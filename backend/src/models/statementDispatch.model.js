const mongoose = require("mongoose")

// One row per (user, period). The unique index is the cross-instance lock: whichever server
// inserts first sends the email, every other server gets a duplicate-key error and skips.
const schema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    period: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 400 }
})
schema.index({ user: 1, period: 1 }, { unique: true })
module.exports = mongoose.model("statementDispatch", schema)
