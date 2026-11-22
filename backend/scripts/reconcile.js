// Verifies stored balances == sum of the immutable ledger.  Usage: npm run reconcile [-- --fix]
require("dotenv").config()
const mongoose = require("mongoose")
const { reconcile } = require("../src/services/ledger.service")

;(async () => {
    await mongoose.connect(process.env.MONGO_URI)
    const fix = process.argv.includes("--fix")
    const r = await reconcile({ fix })
    console.log(`Checked ${r.checked} accounts, ${r.mismatches.length} mismatch(es)${fix ? `, ${r.fixed} fixed` : ""}`)
    r.mismatches.forEach((m) => console.log(m))
    await mongoose.disconnect()
    process.exit(r.mismatches.length && !fix ? 1 : 0)
})().catch((e) => { console.error(e.message); process.exit(1) })
