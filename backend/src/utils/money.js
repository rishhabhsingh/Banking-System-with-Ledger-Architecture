const ApiError = require("./ApiError")

// All money is stored as INTEGER paise. Never floats.
const MAX_TXN_MINOR = 1_00_00_000_00 // 1 crore rupees

function toMinor(value) {
    const s = String(value ?? "").trim()
    if (!/^\d+(\.\d{1,2})?$/.test(s)) {
        throw new ApiError(400, "Amount must be a positive number with at most 2 decimal places")
    }
    const minor = Math.round(parseFloat(s) * 100)
    if (minor < 1) throw new ApiError(400, "Amount must be at least 0.01")
    if (minor > MAX_TXN_MINOR) throw new ApiError(400, "Amount exceeds the per-transaction limit")
    return minor
}

const formatINR = (minor) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(minor / 100)

module.exports = { toMinor, formatINR }
