const crypto = require("crypto")
const jwt = require("jsonwebtoken")
const userModel = require("../models/user.model")
const blacklist = require("../models/tokenBlacklist.model")
const ApiError = require("../utils/ApiError")

const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex")
const getToken = (req) => req.cookies?.token || req.headers.authorization?.split(" ")[1]

async function authenticate(req, { requireSystem = false } = {}) {
    const token = getToken(req)
    if (!token) throw new ApiError(401, "Unauthorized: token is missing")

    let decoded
    try { decoded = jwt.verify(token, process.env.JWT_SECRET) }
    catch { throw new ApiError(401, "Unauthorized: token is invalid or expired") }

    if (await blacklist.exists({ tokenHash: hashToken(token) })) {
        throw new ApiError(401, "Unauthorized: token has been revoked")
    }
    const user = await userModel.findById(decoded.userId).select("+systemUser")
    if (!user) throw new ApiError(401, "Unauthorized: user not found")
    if (requireSystem && !user.systemUser) throw new ApiError(403, "Forbidden: system user only")

    req.user = user
    req.token = token
    req.tokenExp = decoded.exp
}

// Express 5 forwards rejected promises to the error handler automatically.
const authMiddleware = async (req, res, next) => { await authenticate(req); next() }
const authSystemUserMiddleware = async (req, res, next) => { await authenticate(req, { requireSystem: true }); next() }

module.exports = { authMiddleware, authSystemUserMiddleware, hashToken }
