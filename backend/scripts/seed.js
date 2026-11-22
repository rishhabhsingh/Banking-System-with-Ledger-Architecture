// Creates the system user + its funding account. Safe to run repeatedly.
require("dotenv").config()
const mongoose = require("mongoose")
const User = require("../src/models/user.model")
const Account = require("../src/models/account.model")

;(async () => {
    const email = (process.env.SYSTEM_EMAIL || "system@ledger.local").toLowerCase()
    const password = process.env.SYSTEM_PASSWORD
    if (!process.env.MONGO_URI || !password) { console.error("Set MONGO_URI and SYSTEM_PASSWORD in .env"); process.exit(1) }
    await mongoose.connect(process.env.MONGO_URI)
    let user = await User.findOne({ email })
    if (!user) {
        user = await User.create({ email, name: "Ledger System", password, systemUser: true })
        console.log("Created system user:", email)
    } else console.log("System user already exists:", email)
    let account = await Account.findOne({ user: user._id })
    if (!account) {
        account = await Account.create({ user: user._id })
        console.log("Created system account:", account.accountNumber)
    } else console.log("System account already exists:", account.accountNumber)
    await mongoose.disconnect()
})().catch((e) => { console.error(e.message); process.exit(1) })
