// Road-following routes between plan stops, via the public OSRM servers run by OpenStreetMap Germany
// (https://routing.openstreetmap.de). Free, no key, but a shared service: we cache, time out, and always
// fall back to the straight line + a Google Maps link, so a failed request never breaks the plan.
//
// Honest limits: OSRM has car, bike and foot profiles — no motorbike profile. Motorbikes use the same
// streets as cars, so "xe máy" reuses the car geometry. Durations are free-flow (no traffic).
// Bus: there is no free public timetable data for Hà Nội here, so buses are a Google Maps hand-off, never invented.

export type TravelMode = 'motorbike' | 'car' | 'bus' | 'walk'
export interface Pt { lat: number; lng: number }
export interface RouteStep { text: string; m: number }
export interface RouteLeg { km: number; min: number; steps: RouteStep[] }
export interface RoutePlan { coords: [number, number][]; legs: RouteLeg[]; km: number; min: number }

const BASE = 'https://routing.openstreetmap.de'
export const PROFILE: Partial<Record<TravelMode, string>> = { motorbike: 'routed-car/route/v1/driving', car: 'routed-car/route/v1/driving', walk: 'routed-foot/route/v1/foot' }
export const GMAPS_MODE: Record<TravelMode, string> = { motorbike: 'two-wheeler', car: 'driving', bus: 'transit', walk: 'walking' }

const cache = new Map<string, RoutePlan>()
export const routeKey = (pts: Pt[], mode: TravelMode) => `${PROFILE[mode] || mode}|${pts.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(';')}`

interface OsrmStep { distance: number; name?: string; maneuver?: { type?: string; modifier?: string } }
const DIR: Record<string, string> = { left: 'trái', right: 'phải', 'slight left': 'chếch trái', 'slight right': 'chếch phải', 'sharp left': 'gấp sang trái', 'sharp right': 'gấp sang phải', straight: 'thẳng', uturn: 'quay đầu' }

export function stepText(s: OsrmStep): string {
  const t = s.maneuver?.type || '', mod = s.maneuver?.modifier || ''
  const on = s.name ? ` vào ${s.name}` : ''
  if (t === 'depart') return `Xuất phát${s.name ? ` trên ${s.name}` : ''}`
  if (t === 'arrive') return 'Đến nơi'
  if (t === 'roundabout' || t === 'rotary' || t === 'roundabout turn') return `Vào vòng xuyến${s.name ? `, đi tiếp ${s.name}` : ''}`
  if (t === 'continue' || (t === 'new name' && (!mod || mod === 'straight'))) return `Đi thẳng${s.name ? ` trên ${s.name}` : ''}`
  if (mod === 'uturn') return `Quay đầu${on}`
  if (mod && DIR[mod]) return mod === 'straight' ? `Đi thẳng${on}` : `Rẽ ${DIR[mod]}${on}`
  return `Đi tiếp${on}`
}

export function parseOsrm(j: any): RoutePlan | null {
  const r = j?.routes?.[0]
  if (j?.code !== 'Ok' || !r?.geometry?.coordinates?.length) return null
  const coords: [number, number][] = r.geometry.coordinates.map((c: number[]) => [c[1], c[0]])
  if (coords.some(c => !Number.isFinite(c[0]) || !Number.isFinite(c[1]))) return null
  const legs: RouteLeg[] = (r.legs || []).map((l: any) => ({
    km: (l.distance || 0) / 1000,
    min: Math.max(1, Math.round((l.duration || 0) / 60)),
    steps: (l.steps || []).filter((s: OsrmStep) => s.distance > 0 || s.maneuver?.type === 'arrive').map((s: OsrmStep) => ({ text: stepText(s), m: Math.round(s.distance || 0) })),
  }))
  return { coords, legs, km: (r.distance || 0) / 1000, min: Math.max(1, Math.round((r.duration || 0) / 60)) }
}

export async function fetchRoute(pts: Pt[], mode: TravelMode, signal?: AbortSignal): Promise<RoutePlan | null> {
  const prof = PROFILE[mode]
  if (!prof || pts.length < 2 || pts.length > 25) return null
  const key = routeKey(pts, mode)
  const hit = cache.get(key)
  if (hit) return hit
  const path = pts.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  const url = `${BASE}/${prof}/${path}?overview=full&geometries=geojson&steps=true`
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 9000)
  const onAbort = () => ctl.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, { signal: ctl.signal })
    if (!res.ok) return null
    const plan = parseOsrm(await res.json())
    if (plan) cache.set(key, plan)
    return plan
  } catch { return null } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort) }
}

export function legUrl(a: Pt, b: Pt, mode: TravelMode): string {
  const p = (s: Pt) => `${s.lat},${s.lng}`
  return `https://www.google.com/maps/dir/?api=1&origin=${p(a)}&destination=${p(b)}&travelmode=${GMAPS_MODE[mode]}`
}
