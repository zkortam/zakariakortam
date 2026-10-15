// Solar position (NOAA approximation, about 0.1 degree accurate for 1950 to 2050). Pure math, no network.

export const SAN_JOSE = { lat: 37.3382, lon: -121.8863 }

const rad = Math.PI / 180

/** Azimuth (degrees clockwise from north) and elevation (degrees above the horizon) of the sun. */
export function sunPosition(date: Date, lat = SAN_JOSE.lat, lon = SAN_JOSE.lon) {
  const jd = date.getTime() / 86400000 + 2440587.5
  const t = (jd - 2451545) / 36525
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t)
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
  const c =
    Math.sin(m * rad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * rad) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * rad) * 0.000289
  const trueLong = l0 + c
  const omega = 125.04 - 1934.136 * t
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad)
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
  const eps = eps0 + 0.00256 * Math.cos(omega * rad)
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad))
  const y = Math.tan((eps / 2) * rad) ** 2
  const eqTime =
    (4 / rad) *
    (y * Math.sin(2 * l0 * rad) -
      2 * e * Math.sin(m * rad) +
      4 * e * y * Math.sin(m * rad) * Math.cos(2 * l0 * rad) -
      0.5 * y * y * Math.sin(4 * l0 * rad) -
      1.25 * e * e * Math.sin(2 * m * rad))
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60
  let tst = (utcMin + eqTime + 4 * lon) % 1440
  if (tst < 0) tst += 1440
  let ha = tst / 4 - 180
  if (ha < -180) ha += 360
  const phi = lat * rad
  const cosZen = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha * rad)
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZen)))
  const el = 90 - zen / rad
  const az =
    (Math.atan2(Math.sin(ha * rad), Math.cos(ha * rad) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) / rad + 180) % 360
  return { azimuth: az, elevation: el }
}

/** A Date for an hour of today's San Jose clock (America/Los_Angeles), for forcing the light in tests. */
export function sanJoseHour(hour: number, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (k: string) => Number(parts.find((p) => p.type === k)?.value)
  // Offset of LA from UTC at this moment, in hours.
  const laHour = get('hour') % 24
  let off = laHour - now.getUTCHours()
  if (off > 12) off -= 24
  if (off < -12) off += 24
  const d = new Date(Date.UTC(get('year'), get('month') - 1, get('day')))
  return new Date(d.getTime() + (hour - off) * 3600000)
}
