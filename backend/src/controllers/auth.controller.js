const jwt = require("jsonwebtoken")
const userModel = require("../models/user.model")
const blacklist = require("../models/tokenBlacklist.model")
const { hashToken } = require("../middleware/auth.middleware")
const emailService = require("../services/email.service")
const ApiError = require("../utils/ApiError")

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000
const cookieOpts = () => ({
    httpOnly: true, // JS cannot read it => XSS cannot steal the session
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: THREE_DAYS
})
const issue = (res, user) => {
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "3d" })
    res.cookie("token", token, cookieOpts())
}
const publicUser = (u) => ({ _id: u._id, email: u.email, name: u.name, isAdmin: !!u.systemUser, statementFrequency: u.statementFrequency })
const str = (v) => (typeof v === "string" ? v.trim() : "")

async function userRegisterController(req, res) {
    const email = str(req.body.email).toLowerCase(), name = str(req.body.name), password = typeof req.body.password === "string" ? req.body.password : ""
    if (!email || !name || !password) throw new ApiError(400, "Name, email and password are required")
    if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters")
    if (await userModel.exists({ email })) throw new ApiError(409, "An account with this email already exists")

    const user = await userModel.create({ email, name, password })
    issue(res, user)
    emailService.sendRegistrationEmail(user.email, user.name)
    res.status(201).json({ user: publicUser(user) })
}

// Pre-computed hash so "unknown email" takes as long as "wrong password" (no user enumeration by timing).
const bcrypt = require("bcryptjs")
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12)

async function userLoginController(req, res) {
    const email = str(req.body.email).toLowerCase(), password = typeof req.body.password === "string" ? req.body.password : ""
    if (!email || !password) throw new ApiError(400, "Email and password are required")
    const user = await userModel.findOne({ email }).select("+password +systemUser")
    const ok = user ? await user.comparePassword(password) : (await bcrypt.compare(password, DUMMY_HASH), false)
    if (!ok) throw new ApiError(401, "Invalid email or password")
    issue(res, user)
    res.json({ user: publicUser(user) })
}

async function userLogoutController(req, res) {
    // authMiddleware ran, so req.token is valid. Revoke it until it would have expired anyway.
    await blacklist.updateOne(
        { tokenHash: hashToken(req.token) },
        { $setOnInsert: { expiresAt: new Date(req.tokenExp * 1000) } },
        { upsert: true }
    )
    res.clearCookie("token", { ...cookieOpts(), maxAge: undefined })
    res.json({ message: "Logged out" })
}

async function updatePreferences(req, res) {
    const f = req.body.statementFrequency
    if (!["OFF", "WEEKLY", "MONTHLY"].includes(f)) throw new ApiError(400, "statementFrequency must be OFF, WEEKLY or MONTHLY")
    if (f !== req.user.statementFrequency) {
        req.user.statementFrequency = f
        req.user.statementsSince = f === "OFF" ? undefined : new Date()
        await req.user.save()
    }
    res.json({ user: publicUser(req.user) })
}

const meController = (req, res) => res.json({ user: publicUser(req.user) })

module.exports = { userRegisterController, userLoginController, userLogoutController, meController, updatePreferences }
