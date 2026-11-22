const User = require("../models/user.model")
const Dispatch = require("../models/statementDispatch.model")
const { isEmailEnabled } = require("./email.service")
const { emailStatements } = require("./statement.service")
const { dayString, addDays, dayStart } = require("../utils/tz")
const logger = require("../utils/logger")

/** The most recent fully completed week (Mon-Sun) or calendar month, as inclusive day strings. */
function lastCompletedPeriod(freq, now = new Date()) {
    const today = dayString(now)
    if (freq === "WEEKLY") {
        const dow = new Date(today + "T00:00:00Z").getUTCDay() // 0 = Sunday
        const monday = addDays(today, -((dow + 6) % 7))
        return { from: addDays(monday, -7), to: addDays(monday, -1) }
    }
    const to = addDays(today.slice(0, 8) + "01", -1)
    return { from: to.slice(0, 8) + "01", to }
}

async function runStatementJob(now = new Date()) {
    if (!isEmailEnabled()) return { skipped: "email disabled" }
    let sent = 0, failed = 0
    for await (const u of User.find({ statementFrequency: { $in: ["WEEKLY", "MONTHLY"] } }).cursor()) {
        const { from, to } = lastCompletedPeriod(u.statementFrequency, now)
        if (u.statementsSince && dayStart(addDays(to, 1)) <= u.statementsSince) continue // period ended before they opted in
        const period = `${u.statementFrequency}:${from}`
        try { await Dispatch.create({ user: u._id, period }) } // claim; duplicate key => someone else has it
        catch (e) { if (e.code === 11000) continue; throw e }
        try {
            if (await emailStatements(u, from, to)) sent++
            else { failed++; await Dispatch.deleteOne({ user: u._id, period }) } // release so the next tick retries
        } catch (e) {
            failed++
            await Dispatch.deleteOne({ user: u._id, period })
            logger.error({ err: e.message, user: String(u._id) }, "statement job failed for user")
        }
    }
    logger.info({ sent, failed }, "statement job finished")
    return { sent, failed }
}

function startScheduler() {
    if (process.env.SCHEDULER_ENABLED === "false") return logger.info("scheduler disabled on this instance")
    const tick = () => runStatementJob().catch((e) => logger.error({ err: e.message }, "scheduler tick failed"))
    setTimeout(tick, 30_000).unref()
    setInterval(tick, 60 * 60 * 1000).unref() // safe on many instances: the unique index lets only one send
    logger.info("statement scheduler started (hourly)")
}

module.exports = { startScheduler, runStatementJob, lastCompletedPeriod }
