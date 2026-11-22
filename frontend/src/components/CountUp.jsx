import { useEffect, useRef, useState } from "react"
import { money } from "../format"

// Animates a paise value to its new amount. Respects prefers-reduced-motion.
export default function CountUp({ value, duration = 800 }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || from.current === value) { setShown(value); from.current = value; return }
    const start = performance.now(), a = from.current
    let raf
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1)
      setShown(Math.round(a + (value - a) * (1 - Math.pow(1 - t, 3))))
      if (t < 1) raf = requestAnimationFrame(step); else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className="num">{money(shown)}</span>
}
