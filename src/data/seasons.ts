import { SEASONS } from './dataset'
import type { Place } from '../types'

export interface SeasonInfo { bestMonths: number[]; season: string }
export const SEASONS_DATA: Record<string, SeasonInfo> = SEASONS

export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'
export const SEASON_LABELS: Record<SeasonKey, { icon: string; desc: string }> = {
  spring: { icon:'🌸', desc:'Ẩm, hoa nở, mưa phùn nhẹ' },
  summer: { icon:'☀️', desc:'Nóng ẩm, mưa rào chiều' },
  autumn: { icon:'🍂', desc:'Đẹp nhất, mát mẻ, khô ráo' },
  winter: { icon:'❄️', desc:'Lạnh khô, sương mù' },
}

export function getCurrentSeason(month: number): SeasonKey {
  if ([2,3,4].includes(month)) return 'spring'
  if ([5,6,7,8].includes(month)) return 'summer'
  if ([9,10,11].includes(month)) return 'autumn'
  return 'winter'
}

export function mergeSeasonsIntoPlaces(places: Place[]): Place[] {
  return places.map(p => ({
    ...p,
    bestMonths: SEASONS_DATA[p.id]?.bestMonths || [1,2,3,4,5,6,7,8,9,10,11,12],
    peakMonths: SEASONS_DATA[p.id] ? peakMonthsOf(p.id) : [],
    season:     SEASONS_DATA[p.id]?.season     || 'Phù hợp quanh năm.',
  }))
}

/**
 * Peak months = months the season text singles out ("tháng 10-11", "(9-11)", "tháng 8-9: …").
 * Falls back to bestMonths when the text names none, so every place has a peak set.
 * Always a subset of bestMonths.
 */
export function peakMonthsOf(id: string): number[] {
  const d = SEASONS_DATA[id]
  if (!d) return []
  const text = d.season || ''
  const found = new Set<number>()
  const re = /(?:tháng\s*|\()(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?/gi
  let m
  while ((m = re.exec(text))) {
    const a = +m[1], b = m[2] ? +m[2] : a
    if (a < 1 || a > 12 || b < 1 || b > 12) continue
    // ranges that wrap the year (12-1) are walked forward
    for (let x = a, n = 0; n < 12; n++, x = x % 12 + 1) { found.add(x); if (x === b) break }
  }
  // season words ("mùa thu", "thu-đông", "trời lạnh") — skipped in clauses that warn against a season
  const WORDS: [RegExp, number[]][] = [[/thu/i, [9, 10, 11]], [/đông|lạnh|se lạnh/i, [12, 1, 2]], [/xuân/i, [2, 3, 4]], [/\bhè\b/i, [5, 6, 7, 8]]]
  for (const clause of text.split(/[.;—]/)) {
    if (/tránh|ít người mua|không phụ thuộc|quanh năm|mọi mùa/i.test(clause)) continue
    for (const [rx, months] of WORDS) if (rx.test(clause)) months.forEach(x => found.add(x))
  }
  const peak = [...found].filter(x => d.bestMonths.includes(x))
  return peak.length ? peak.sort((x, y) => x - y) : d.bestMonths
}

/** 'peak' = this month is singled out for the place; 'ok' = fine but not special; 'off' = better another month. */
export function seasonLevel(id: string, month: number): 'peak' | 'ok' | 'off' {
  const d = SEASONS_DATA[id]
  if (!d) return 'ok'
  if (!d.bestMonths.includes(month)) return 'off'
  const peak = peakMonthsOf(id)
  return peak.length < d.bestMonths.length && peak.includes(month) ? 'peak' : 'ok'
}
