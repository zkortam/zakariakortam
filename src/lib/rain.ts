// Is it raining in San Jose right now? Open-Meteo (no key), cached per tab for ten minutes.
import { SAN_JOSE } from './sun'

const KEY = 'zk-rain'
const TTL = 10 * 60 * 1000
const URL_ = `https://api.open-meteo.com/v1/forecast?latitude=${SAN_JOSE.lat}&longitude=${SAN_JOSE.lon}&current=precipitation,rain,weather_code`

/** mm/h of rain right now (0 when dry). `?rain=1` forces a light shower, `?rain=4` a heavier one. */
export async function rainNow(): Promise<number> {
  const forced = new URLSearchParams(location.search).get('rain')
  if (forced !== null) return Math.max(0, Number(forced) || 0)
  try {
    const hit = sessionStorage.getItem(KEY)
    if (hit) {
      const { t, mm } = JSON.parse(hit) as { t: number; mm: number }
      if (Date.now() - t < TTL) return mm
    }
  } catch {}
  try {
    const ctl = new AbortController()
    const to = setTimeout(() => ctl.abort(), 4000)
    const r = await fetch(URL_, { signal: ctl.signal })
    clearTimeout(to)
    if (!r.ok) return 0
    const j = (await r.json()) as { current?: { precipitation?: number; rain?: number; weather_code?: number } }
    const c = j.current || {}
    // Drizzle and rain codes (51-67, 80-82, 95+) count even when the hourly amount rounds to zero.
    const code = c.weather_code ?? 0
    const wet = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95
    const mm = Math.max(c.rain ?? 0, c.precipitation ?? 0, wet ? 0.2 : 0)
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), mm }))
    } catch {}
    return mm
  } catch {
    return 0
  }
}
