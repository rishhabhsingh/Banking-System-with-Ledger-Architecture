const router = require("express").Router()
const rateLimit = require("express-rate-limit")
const c = require("../controllers/account.controller")
const { authMiddleware } = require("../middleware/auth.middleware")

const emailLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: "Too many statement emails, try again later" } })

router.use(authMiddleware)
router.post("/", c.createAccountController)
router.get("/", c.getUserAccountsController)
router.get("/recipients/recent", c.recentRecipientsController)
router.get("/lookup/:accountNumber", c.lookupAccountController)
router.get("/balance/:accountId", c.getAccountBalanceController)
router.get("/:accountId/ledger", c.getAccountLedgerController)
router.get("/:accountId/history", c.getAccountHistoryController)
router.get("/:accountId/statement.csv", c.downloadStatementCsvController)
router.post("/:accountId/statement/email", emailLimiter, c.emailStatementController)
module.exports = router
