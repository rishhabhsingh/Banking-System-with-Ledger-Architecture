// One configurable business timezone (fixed offset, e.g. "+05:30" for India).
const OFFSET = process.env.APP_TZ_OFFSET || "+05:30"
const m = /^([+-])(\d{2}):(\d{2})$/.exec(OFFSET)
if (!m) throw new Error("APP_TZ_OFFSET must look like +05:30")
const OFFSET_MIN = (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))

const dayString = (d = new Date()) => new Date(d.getTime() + OFFSET_MIN * 60000).toISOString().slice(0, 10)
const addDays = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10)
const dayStart = (day) => new Date(`${day}T00:00:00${OFFSET}`)
const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"))

module.exports = { OFFSET, dayString, addDays, dayStart, isDay }
