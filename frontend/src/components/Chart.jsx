import { useId, useState } from "react"
import { money } from "../format"

const W = 640, H = 200, PAD = 14

// Balance area chart with a hover/touch scrubber. Colours come from CSS (currentColor + --chart-fill).
export default function Chart({ points }) {
  const id = useId()
  const [hover, setHover] = useState(null)
  if (!points?.length) return null
  const vals = points.map((p) => p.balance)
  const min = Math.min(...vals), max = Math.max(...vals)
  const span = max - min || 1
  const x = (i) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const y = (v) => (max === min ? H / 2 : H - PAD - ((v - min) / span) * (H - PAD * 2 - 10))
  // Step line: a balance holds until the next movement, which is how a ledger actually behaves.
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.balance).toFixed(1)}`).join(" ")
  const area = `${line} L${x(points.length - 1)} ${H} L${x(0)} ${H} Z`

  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const cx = (e.touches?.[0]?.clientX ?? e.clientX) - r.left
    setHover(Math.max(0, Math.min(points.length - 1, Math.round((cx / r.width) * (points.length - 1)))))
  }
  const hp = hover != null ? points[hover] : null

  return (
    <div className="chart" onMouseMove={move} onTouchMove={move} onMouseLeave={() => setHover(null)} onTouchEnd={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Balance over time">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop className="g-top" offset="0" /><stop className="g-bot" offset="1" /></linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} />
        <path d={line} className="chart-line" vectorEffect="non-scaling-stroke" />
        {hp && <line className="chart-cursor" x1={x(hover)} x2={x(hover)} y1="0" y2={H} vectorEffect="non-scaling-stroke" />}
      </svg>
      {hp && (
        <>
          <span className="chart-dot" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(hp.balance) / H) * 100}%` }} />
          <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
            <b className="num">{money(hp.balance)}</b>
            <span>{new Date(hp.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
          </div>
        </>
      )}
    </div>
  )
}
