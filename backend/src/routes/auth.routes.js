const router = require("express").Router()
const rateLimit = require("express-rate-limit")
const c = require("../controllers/auth.controller")
const { authMiddleware } = require("../middleware/auth.middleware")

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: "Too many attempts, try again later" } })

router.post("/register", limiter, c.userRegisterController)
router.post("/login", limiter, c.userLoginController)
router.post("/logout", authMiddleware, c.userLogoutController)
router.patch("/preferences", authMiddleware, c.updatePreferences)
router.get("/me", authMiddleware, c.meController)
module.exports = router
