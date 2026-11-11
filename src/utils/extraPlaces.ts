// Places found by "Hỏi AI tìm nơi khác" that the visitor chose to add to their plan. They are not in the site's dataset, so
// the plan carries them inside `answers.extras`. Their opening hours, price and photos are unknown and are never guessed:
// no hours → always schedulable, cost 0 (shown as "chưa rõ"), and the stop card says so.
import type { Answers, Place, PlaceType, Mood, Group } from '../types'

export const EXTRA_PREFIX = 'AI_'
export interface ExtraPlace { id: string; name: string; area: string; lat: number; lng: number; category?: string; address?: string; why?: string; duration: number }
export const isExtraId = (id: string) => id.startsWith(EXTRA_PREFIX)
export const EXTRA_DURATIONS = [30, 45, 60, 90, 120]

const ALL_MOODS: Mood[] = ['calm', 'adventure', 'nostalgia', 'energy']
const ALL_GROUPS: Group[] = ['solo', 'couple', 'friends', 'family']

/** Stable id from the coordinates, so adding the same place twice is one place. */
export function extraId(lat: number, lng: number): string { return `${EXTRA_PREFIX}${lat.toFixed(5)}_${lng.toFixed(5)}`.replace(/\./g, 'p').replace(/-/g, 'm') }

export function guessType(category = ''): PlaceType {
  const c = category.toLowerCase()
  if (/cà phê|cafe|coffee|trà/.test(c)) return 'cafe'
  if (/quán ăn|nhà hàng|ẩm thực|phở|bún|bánh|lẩu|quán/.test(c)) return 'food'
  if (/bảo tàng|thư viện|nhà hát|triển lãm|di tích|museum|library/.test(c)) return 'museum'
  if (/công viên|hồ|vườn|park|lake/.test(c)) return 'nature'
  if (/chợ|market/.test(c)) return 'market'
  return 'attraction'
}

export function makeExtra(p: { name: string; area?: string; lat: number; lng: number; category?: string; address?: string; why?: string }, duration = 60): ExtraPlace {
  return { id: extraId(p.lat, p.lng), name: p.name.slice(0, 80), area: (p.area || '').slice(0, 60), lat: p.lat, lng: p.lng, category: p.category?.slice(0, 40), address: p.address?.slice(0, 160), why: p.why?.slice(0, 180), duration: clampDuration(duration) }
}
export const clampDuration = (n: number) => (Number.isFinite(n) ? Math.min(180, Math.max(20, Math.round(n))) : 60)

export function extraToPlace(e: ExtraPlace): Place {
  return {
    id: e.id, name: e.name, area: e.area || 'Hà Nội', lat: e.lat, lng: e.lng,
    type: guessType(e.category), moods: ALL_MOODS, groups: ALL_GROUPS, indoor: true, timeOfDay: ['any'],
    duration: clampDuration(e.duration), cost: 0,
    desc: e.why || '', badges: ['AI gợi ý'], tip: '', address: e.address,
  }
}

/** Valid extras of an answers object (shape-checked, deduped, at most `max`). */
export function extrasOf(answers?: Partial<Answers> | null, max = 3): ExtraPlace[] {
  const out: ExtraPlace[] = [], seen = new Set<string>()
  for (const e of answers?.extras || []) {
    if (!e || typeof e.id !== 'string' || !isExtraId(e.id) || typeof e.name !== 'string' || !Number.isFinite(e.lat) || !Number.isFinite(e.lng) || seen.has(e.id)) continue
    seen.add(e.id); out.push(e)
    if (out.length >= max) break
  }
  return out
}

/** The dataset plus the visitor's own extra places (only those, never anyone else's). */
export function withExtras(places: Place[], answers?: Partial<Answers> | null): Place[] {
  const ex = extrasOf(answers)
  if (!ex.length) return places
  const have = new Set(places.map(p => p.id))
  return [...places, ...ex.filter(e => !have.has(e.id)).map(extraToPlace)]
}
