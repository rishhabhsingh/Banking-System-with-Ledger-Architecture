const test = require("node:test")
const assert = require("node:assert")
const { csvCell, toCsv } = require("../src/services/statement.service")
const { lastCompletedPeriod } = require("../src/services/scheduler.service")
const { dayString, addDays, dayStart, isDay } = require("../src/utils/tz")

test("csv quotes special characters", () => {
    assert.strictEqual(csvCell('a,b'), '"a,b"')
    assert.strictEqual(csvCell('say "hi"'), '"say ""hi"""')
    assert.strictEqual(csvCell("line\nbreak"), '"line\nbreak"')
})
test("csv neutralises spreadsheet formula injection", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)"]) assert.ok(csvCell(evil).startsWith("'") || csvCell(evil).startsWith("\"'"))
})
test("statement CSV has opening/closing rows and running balance", () => {
    const csv = toCsv({ opening: 1000, totalDebit: 500, totalCredit: 2000, closing: 2500, rows: [
        { date: new Date("2026-11-10T06:30:00Z"), description: "Received from 1", reference: "abc", debit: 0, credit: 2000, balance: 3000 },
        { date: new Date("2026-11-11T06:30:00Z"), description: "Sent to 2", reference: "def", debit: 500, credit: 0, balance: 2500 }] }, "+05:30")
    const lines = csv.replace("\uFEFF", "").trim().split("\r\n")
    assert.strictEqual(lines.length, 5)
    assert.ok(lines[1].endsWith("10.00")); assert.ok(lines[2].includes("2026-11-10,12:00:00")); assert.ok(lines[4].endsWith("25.00"))
})
test("timezone day helpers", () => {
    assert.strictEqual(dayString(new Date("2026-11-14T20:00:00Z")), "2026-11-15") // 01:30 IST next day
    assert.strictEqual(addDays("2026-03-01", -1), "2026-02-28")
    assert.strictEqual(dayStart("2026-11-15").toISOString(), "2026-11-14T18:30:00.000Z")
    assert.ok(isDay("2026-02-28")); assert.ok(!isDay("2026-02-31x")); assert.ok(!isDay("nope"))
})
test("last completed week / month", () => {
    const sun = new Date("2026-11-15T10:00:00+05:30")  // Sunday
    assert.deepStrictEqual(lastCompletedPeriod("WEEKLY", sun), { from: "2026-11-02", to: "2026-11-08" })
    const mon = new Date("2026-11-16T00:30:00+05:30")  // Monday: the week that just ended
    assert.deepStrictEqual(lastCompletedPeriod("WEEKLY", mon), { from: "2026-11-09", to: "2026-11-15" })
    assert.deepStrictEqual(lastCompletedPeriod("MONTHLY", sun), { from: "2026-10-01", to: "2026-10-31" })
    assert.deepStrictEqual(lastCompletedPeriod("MONTHLY", new Date("2027-01-01T00:10:00+05:30")), { from: "2026-12-01", to: "2026-12-31" })
})
