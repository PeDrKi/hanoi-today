// "Đáng đến nhất" on the map screen: a short, explainable list of must-see places per category.
// Nothing here is invented: the order comes only from fields already in the data (the editors' ⭐ flag, the season table, how many moods / groups a place suits).
import type { Place, PlaceType } from '../types'

export type PickReason = 'editor' | 'peak' | 'season' | 'rated' | 'wide'
export interface RatingAgg { avg: number; n: number }
export type SeasonFit = 'peak' | 'ok' | 'off'
export interface Pick { place: Place; score: number; reasons: PickReason[]; offSeason: boolean; rating?: RatingAgg }
export interface PickGroup { type: PlaceType; picks: Pick[] }

export const PICK_TYPES: PlaceType[] = ['attraction', 'food', 'cafe', 'museum', 'nature', 'market']

/** Weights, kept in one place so the Admin / report can state the rule exactly. */
export const PICK_WEIGHTS = { editor: 100, peak: 4, ok: 1.5, off: -3, wideMax: 3, rating: 2.5 }
/** A rating counts like this many extra votes of 3.5 stars, so one or two votes barely move a place; ten or more clearly do. */
export const RATING_PRIOR = { votes: 5, stars: 3.5 }
/** Shown as "highly rated" from this many votes and average. */
export const RATED_MIN = { n: 5, avg: 4 }

/** Confidence-weighted average (Bayesian): (n·avg + m·prior) / (n + m). */
export const bayes = (r: RatingAgg) => (r.n * r.avg + RATING_PRIOR.votes * RATING_PRIOR.stars) / (r.n + RATING_PRIOR.votes)

/** How wide a place's appeal is: share of the 4 moods and 4 groups it suits, 0..1. */
export const breadth = (p: Pick['place']) => (Math.min(4, p.moods.length) + Math.min(4, p.groups.length)) / 8

export function scorePick(p: Place, fit: SeasonFit, rating?: RatingAgg): Pick {
  const W = PICK_WEIGHTS, reasons: PickReason[] = []
  let score = breadth(p) * W.wideMax
  if (p.featured) { score += W.editor; reasons.push('editor') }
  if (fit === 'peak') { score += W.peak; reasons.push('peak') }
  else if (fit === 'ok') { score += W.ok; if (p.season && p.season !== 'Phù hợp quanh năm.') reasons.push('season') }
  else score += W.off
  const r = rating && rating.n > 0 ? rating : undefined
  if (r) { score += (bayes(r) - RATING_PRIOR.stars) * W.rating; if (r.n >= RATED_MIN.n && r.avg >= RATED_MIN.avg) reasons.push('rated') }
  if (p.moods.length >= 3 && p.groups.length >= 3) reasons.push('wide')
  return { place: p, score, reasons, offSeason: fit === 'off', rating: r }
}

const byName = (a: Pick, b: Pick) => b.score - a.score || a.place.name.localeCompare(b.place.name, 'vi') || a.place.id.localeCompare(b.place.id)

/** Best `per` places of each category (empty categories are left out). `fit` says how well the chosen month suits a place. */
export function topPicksByType(places: Place[], fit: (p: Place) => SeasonFit, per = 3, types: PlaceType[] = PICK_TYPES, ratings: Record<string, RatingAgg> = {}): PickGroup[] {
  const out: PickGroup[] = []
  for (const type of types) {
    const picks = places.filter(p => p.type === type).map(p => scorePick(p, fit(p), ratings[p.id])).sort(byName).slice(0, per)
    if (picks.length) out.push({ type, picks })
  }
  return out
}
