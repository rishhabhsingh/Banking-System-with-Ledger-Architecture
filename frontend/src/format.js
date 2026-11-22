const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })
export const money = (paise) => inr.format(paise / 100)
export const groupNumber = (n = "") => n.replace(/(\d{4})(?=\d)/g, "$1 ")
export const last4 = (n = "") => n.slice(-4)
export const time = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
export const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
export const localDay = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
export const daysAgo = (n) => localDay(new Date(Date.now() - n * 864e5))
export function dayLabel(iso) {
  const d = localDay(new Date(iso)), today = localDay()
  if (d === today) return "Today"
  if (d === daysAgo(1)) return "Yesterday"
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
}
export const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening" }
