const test = require("node:test")
const assert = require("node:assert")
const { toMinor } = require("../src/utils/money")

test("converts rupees to paise without float drift", () => {
    assert.strictEqual(toMinor("0.10"), 10)
    assert.strictEqual(toMinor(19.99), 1999)
    assert.strictEqual(toMinor("1000"), 100000)
    assert.strictEqual(toMinor(1.15), 115)
})
test("rejects bad amounts", () => {
    for (const bad of [0, "0.00", -5, "abc", "1.234", "", null, undefined, "1e3", 10 ** 9])
        assert.throws(() => toMinor(bad), `should reject ${bad}`)
})
