const ApiError = require("../utils/ApiError")
const logger = require("../utils/logger")

function notFound(req, res) {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof ApiError) return res.status(err.status).json({ message: err.message, ...err.extra })
    if (err.name === "ValidationError") {
        const message = Object.values(err.errors).map((e) => e.message).join(", ")
        return res.status(400).json({ message })
    }
    if (err.name === "CastError") return res.status(400).json({ message: `Invalid ${err.path}` })
    if (err.code === 11000) return res.status(409).json({ message: "Duplicate value: already exists" })
    if (err.type === "entity.parse.failed") return res.status(400).json({ message: "Malformed JSON body" })

    logger.error({ err, requestId: req.id }, "unhandled error")
    res.status(500).json({ message: "Internal server error", requestId: req.id })
}
module.exports = { notFound, errorHandler }
