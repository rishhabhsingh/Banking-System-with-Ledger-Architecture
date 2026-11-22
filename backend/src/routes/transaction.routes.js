const router = require("express").Router()
const c = require("../controllers/transaction.controller")
const { authMiddleware, authSystemUserMiddleware } = require("../middleware/auth.middleware")

router.get("/", authMiddleware, c.listTransactions)
router.post("/", authMiddleware, c.createTransaction)
router.post("/demo-funds", authMiddleware, c.demoFunds)
router.post("/system/initial-funds", authSystemUserMiddleware, c.createInitialFundsTransaction)
module.exports = router
