const mongoose = require("mongoose")
const logger = require("../utils/logger")

async function connectToDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, maxPoolSize: Number(process.env.DB_POOL_SIZE) || 20 })
        logger.info("Connected to MongoDB")
    } catch (err) {
        // The old code swallowed the real reason. Print it.
        logger.error("Error connecting to DB:", err.message)
        const m = err.message.toLowerCase()
        if (m.includes("whitelist") || m.includes("server selection") || m.includes("timed out")) {
            logger.error("-> Atlas: Network Access > add your current IP (or 0.0.0.0/0 for development).")
        }
        if (m.includes("auth")) logger.error("-> Wrong DB username/password. URL-encode special chars in the password (@ -> %40).")
        if (m.includes("enotfound") || m.includes("querysrv")) logger.error("-> Check the cluster host in MONGO_URI, and your internet/DNS.")
        process.exit(1)
    }
}
module.exports = connectToDB
