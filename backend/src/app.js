const path = require("path")
const fs = require("fs")
const crypto = require("crypto")
const express = require("express")
const mongoose = require("mongoose")
const cookieParser = require("cookie-parser")
const cors = require("cors")
const helmet = require("helmet")
const compression = require("compression")
const pinoHttp = require("pino-http")
const rateLimit = require("express-rate-limit")
const logger = require("./utils/logger")
const { notFound, errorHandler } = require("./middleware/error.middleware")

const app = express()

app.set("trust proxy", 1) // behind Render/Railway/nginx: real client IPs for rate limiting
app.use(pinoHttp({
    logger,
    genReqId: (req, res) => { const id = req.headers["x-request-id"] || crypto.randomUUID(); res.setHeader("X-Request-Id", id); return id },
    autoLogging: { ignore: (req) => req.url === "/api/health" || req.url === "/api/ready" }
}))
app.use(helmet({
    contentSecurityPolicy: { directives: {
        "default-src": ["'self'"], "script-src": ["'self'"], "style-src": ["'self'"], "style-src-attr": ["'unsafe-inline'"],
        "img-src": ["'self'", "data:"], "font-src": ["'self'", "data:"], "connect-src": ["'self'"]
    } }
}))
app.use(compression())
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }))
app.use(express.json({ limit: "10kb" }))
app.use(cookieParser())
// NOTE: this limiter is per-process memory. With many instances, back it with a shared store (e.g. Redis).
app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }))

app.get("/api/health", (req, res) => res.json({ status: "ok" })) // liveness
app.get("/api/ready", (req, res) => { // readiness: only route traffic when the DB is connected
    const ok = mongoose.connection.readyState === 1
    res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "not-ready" })
})

app.use("/api/auth", require("./routes/auth.routes"))
app.use("/api/accounts", require("./routes/account.routes"))
app.use("/api/transactions", require("./routes/transaction.routes"))
app.use("/api/admin", require("./routes/admin.routes"))
app.use("/api", notFound)

// Single-container deploy: if the React build is present (Docker copies it to ./public), serve it.
const publicDir = process.env.FRONTEND_DIST || path.join(__dirname, "../public")
if (fs.existsSync(path.join(publicDir, "index.html"))) {
    app.use("/assets", express.static(path.join(publicDir, "assets"), { maxAge: "1y", immutable: true }))
    app.use(express.static(publicDir, { index: false, maxAge: "1h" }))
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(publicDir, "index.html"), { headers: { "Cache-Control": "no-cache" } }))
} else {
    app.get("/", (req, res) => res.send("Ledger Service is up and running"))
}

app.use(notFound)
app.use(errorHandler)
module.exports = app
