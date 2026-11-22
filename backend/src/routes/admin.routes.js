const router = require("express").Router()
const c = require("../controllers/admin.controller")
const { authSystemUserMiddleware } = require("../middleware/auth.middleware")

router.use(authSystemUserMiddleware)
router.get("/stats", c.stats)
router.get("/accounts", c.listAccounts)
router.patch("/accounts/:accountId/status", c.setAccountStatus)
router.get("/reconcile", c.reconcileController)
router.get("/transactions", c.listTransactions)
router.post("/transactions/:id/reverse", c.reverseTransaction)
module.exports = router
