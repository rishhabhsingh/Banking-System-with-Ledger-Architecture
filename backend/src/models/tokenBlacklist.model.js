const mongoose = require("mongoose")

const schema = new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL: auto-removed
})
module.exports = mongoose.model("tokenBlacklist", schema)
