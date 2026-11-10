// 1–5 star ratings of places. Anonymous: one rating per place per device (a random id kept in this browser), changeable.
// Offline-first: your own stars are kept here; they are also sent to the Worker when API_URL is set, and re-sent later if the network failed.
import { useSyncExternalStore } from 'react'
import { API_URL } from '../config'

export interface Agg { avg: number; n: number }
export type Aggs = Record<string, Agg>

const MINE = 'ht_place_ratings', DEV = 'ht_dev', CACHE = 'ht_ratings_cache', PENDING = 'ht_ratings_pending'
const TTL = 5 * 60 * 1000

const read = <T,>(k: string, d: T): T => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) as T : d } catch { return d } }
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode: the session still works */ } }

export function getDevice(): string {
  let d = ''
  try { d = localStorage.getItem(DEV) || '' } catch { /* ignore */ }
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(d)) {
    d = (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9_-]/g, '')
    try { localStorage.setItem(DEV, d) } catch { /* ignore */ }
  }
  return d
}

export const clampStars = (n: number) => Math.min(5, Math.max(1, Math.round(n)))

/** New aggregate after this device changes its rating from `prev` (or none) to `next`; the server stays the source of truth on the next refresh. */
export function applyMine(a: Agg | undefined, prev: number | undefined, next: number): Agg {
  const n0 = a?.n ?? 0, sum0 = (a?.avg ?? 0) * n0
  if (prev && n0 > 0) return { avg: Math.round(((sum0 - prev + next) / n0) * 100) / 100, n: n0 }
  return { avg: Math.round(((sum0 + next) / (n0 + 1)) * 100) / 100, n: n0 + 1 }
}

interface State { mine: Record<string, number>; aggs: Aggs }
let state: State = { mine: read(MINE, {}), aggs: read<{ at: number; aggs: Aggs }>(CACHE, { at: 0, aggs: {} }).aggs }
let fetchedAt = read<{ at: number }>(CACHE, { at: 0 }).at
const subs = new Set<() => void>()
const set = (s: State) => { state = s; subs.forEach(f => f()) }

export async function fetchRatings(force = false): Promise<void> {
  if (!API_URL || (!force && Date.now() - fetchedAt < TTL)) return
  try {
    const r = await fetch(API_URL + '/v1/ratings'); if (!r.ok) return
    const j = await r.json() as { ratings?: Aggs }; if (!j.ratings) return
    fetchedAt = Date.now(); write(CACHE, { at: fetchedAt, aggs: j.ratings })
    set({ ...state, aggs: j.ratings })
  } catch { /* offline: keep what we have */ }
}

export async function flushPending(): Promise<void> {
  if (!API_URL) return
  const pend = read<Record<string, number>>(PENDING, {})
  for (const [id, stars] of Object.entries(pend)) {
    try {
      const r = await fetch(`${API_URL}/v1/rate/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: getDevice(), stars }) })
      if (r.ok || r.status === 400) { const cur = read<Record<string, number>>(PENDING, {}); delete cur[id]; write(PENDING, cur) }   // 400 = will never be accepted, do not retry forever
      else if (r.status === 429) break
    } catch { break }
  }
}

export function rate(id: string, stars: number): void {
  const s = clampStars(stars), prev = state.mine[id]
  const mine = { ...state.mine, [id]: s }; write(MINE, mine)
  const aggs = { ...state.aggs, [id]: applyMine(state.aggs[id], prev, s) }
  write(PENDING, { ...read<Record<string, number>>(PENDING, {}), [id]: s })
  set({ mine, aggs })
  void flushPending().then(() => fetchRatings(true))
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
let started = false
/** Your stars, everybody's averages, and rate(). The first use refreshes the averages (at most every 5 minutes) and re-sends any rating the network dropped. */
export function useRatings(): State & { rate: typeof rate } {
  const s = useSyncExternalStore(subscribe, () => state)
  if (!started) { started = true; void flushPending().then(() => fetchRatings()) }
  return { ...s, rate }
}

/** Display like "4,3" (Vietnamese decimal comma). */
export const fmtAvg = (n: number, lang: 'vi' | 'en' = 'vi') => n.toFixed(1).replace('.', lang === 'vi' ? ',' : '.')

/** Test hook: start from a clean state. */
export function __resetRatings(mine: Record<string, number> = {}, aggs: Aggs = {}) { state = { mine, aggs }; fetchedAt = 0; started = true }
export const __getRatings = () => state
