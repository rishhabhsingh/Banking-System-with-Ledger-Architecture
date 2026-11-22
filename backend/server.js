require("dotenv").config()
const mongoose = require("mongoose")
const logger = require("./src/utils/logger")
const { validateEnv } = require("./src/config/env")

validateEnv()
const app = require("./src/app")
const connectToDB = require("./src/config/db")
const { startScheduler } = require("./src/services/scheduler.service")

const PORT = process.env.PORT || 3000

async function start() {
    await connectToDB()
    const server = app.listen(PORT, () => logger.info(`Server is running on port ${PORT}`))
    server.keepAliveTimeout = 65_000 // longer than typical load-balancer idle timeouts
    startScheduler()

    const shutdown = (signal) => {
        logger.info(`${signal} received, draining connections`)
        setTimeout(() => process.exit(1), 10_000).unref() // hard stop if something hangs
        server.close(async () => { await mongoose.disconnect(); process.exit(0) })
    }
    process.on("SIGINT", () => shutdown("SIGINT"))
    process.on("SIGTERM", () => shutdown("SIGTERM"))
}

process.on("unhandledRejection", (err) => logger.error({ err }, "unhandled rejection"))
start()
