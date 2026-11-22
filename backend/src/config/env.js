const logger = require("../utils/logger")

function validateEnv() {
    const prod = process.env.NODE_ENV === "production"
    const missing = ["MONGO_URI", "JWT_SECRET"].filter((k) => !process.env[k])
    if (missing.length) { logger.fatal(`Missing required env vars: ${missing.join(", ")} (see .env.example)`); process.exit(1) }
    if (prod && process.env.JWT_SECRET.length < 32) { logger.fatal("JWT_SECRET must be at least 32 characters in production"); process.exit(1) }
    if (prod && process.env.ALLOW_DEMO_FUNDS === "true") logger.warn("ALLOW_DEMO_FUNDS is true in production: anyone can mint demo money. Turn it off.")
}
module.exports = { validateEnv }
