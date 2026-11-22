const nodemailer = require("nodemailer")
const logger = require("../utils/logger")
const { formatINR } = require("../utils/money")

let transporter // created lazily, so a bad email config can NEVER crash or block the app

function getTransporter() {
    if (transporter !== undefined) return transporter
    const e = process.env
    if (e.EMAIL_ENABLED !== "true") return (transporter = null)
    if (e.CLIENT_ID && e.CLIENT_SECRET && e.REFRESH_TOKEN && !e.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { type: "OAuth2", user: e.EMAIL_USER, clientId: e.CLIENT_ID, clientSecret: e.CLIENT_SECRET, refreshToken: e.REFRESH_TOKEN }
        })
    } else if (e.EMAIL_USER && e.EMAIL_PASS) {
        transporter = nodemailer.createTransport({ service: "gmail", auth: { user: e.EMAIL_USER, pass: e.EMAIL_PASS } })
    } else {
        logger.warn("EMAIL_ENABLED=true but credentials are missing; emails disabled")
        transporter = null
    }
    return transporter
}

const isEmailEnabled = () => !!getTransporter()
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))

/** Awaitable. Resolves true if sent, false if disabled/failed. Never throws. */
async function sendMail({ to, subject, text, html, attachments }) {
    const t = getTransporter()
    if (!t) { logger.info({ to, subject }, "email disabled, not sent"); return false }
    try {
        await t.sendMail({ from: `"Ledger Bank" <${process.env.EMAIL_USER}>`, to, subject, text, html, attachments })
        logger.info({ to, subject }, "email sent")
        return true
    } catch (err) {
        logger.error({ err: err.message, to, subject }, "email failed (ignored)")
        return false
    }
}
const fireAndForget = (opts) => { sendMail(opts) }

const sendRegistrationEmail = (email, name) => fireAndForget({
    to: email, subject: "Welcome to Ledger Bank",
    text: `Hello ${name},\n\nYour account is ready.\n\nLedger Bank`,
    html: `<p>Hello ${esc(name)},</p><p>Your account is ready.</p>`
})

const sendTransactionEmail = (email, name, amountMinor, toAccountNumber) => fireAndForget({
    to: email, subject: "Transfer successful",
    text: `Hello ${name},\n\nYour transfer of ${formatINR(amountMinor)} to account ${toAccountNumber} was successful.`,
    html: `<p>Hello ${esc(name)},</p><p>Your transfer of <b>${esc(formatINR(amountMinor))}</b> to account ${esc(toAccountNumber)} was successful.</p>`
})

module.exports = { sendMail, isEmailEnabled, sendRegistrationEmail, sendTransactionEmail, esc }
