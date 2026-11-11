import { describe, it, expect } from 'vitest'
import { recommend, swapStop, MAX_MUST } from '../recommend'
import { makeExtra, extraId, extrasOf, withExtras, guessType, isExtraId, clampDuration } from '../extraPlaces'
import { getPlaces } from '../../data/placeStore'
import type { Answers, Plan } from '../../types'

const NOW = new Date(2026, 10, 11, 8, 0)
const base = (o: Partial<Answers> = {}): Answers => ({ mood: 'calm', budget: 1_000_000, people: 2, time: 'half', group: 'couple', mode: 'tourist', focus: 'all', startHour: 8, ...o })
const run = (a: Answers, wxCode = 0): Plan => recommend({ answers: a, wx: wxCode ? ({ code: wxCode, temp: 24 } as never) : null, now: NOW })
// a place near Hồ Gươm that is NOT in the dataset
const lib = makeExtra({ name: 'Thư viện Quốc gia Việt Nam', area: 'Hoàn Kiếm', lat: 21.0245, lng: 105.8586, category: 'Thư viện công cộng', address: '31 Tràng Thi', why: 'Thư viện lớn.' }, 90)

describe('AI-found places added to a plan', () => {
  it('helpers: stable id, type guess, clamped duration, shape-checked list', () => {
    expect(isExtraId(lib.id)).toBe(true); expect(lib.id).toBe(extraId(21.0245, 105.8586)); expect(lib.id).not.toMatch(/[.\-]/)
    expect(guessType('Quán cà phê sách')).toBe('cafe'); expect(guessType('Thư viện công cộng')).toBe('museum'); expect(guessType('')).toBe('attraction')
    expect(clampDuration(5)).toBe(20); expect(clampDuration(999)).toBe(180); expect(clampDuration(NaN)).toBe(60)
    expect(extrasOf({ extras: [lib, lib, { id: 'HK001' } as never, null as never, { ...lib, id: 'AI_x', lat: NaN }] })).toHaveLength(1)
    expect(withExtras(getPlaces(), { extras: [lib] })).toHaveLength(getPlaces().length + 1)
    expect(withExtras(getPlaces(), {})).toBe(getPlaces())
  })
  it('the added place is in the plan, flagged as picked, with its chosen duration and no invented price/hours', () => {
    const p = run(base({ extras: [lib] }))
    const s = p.stops.find(x => x.id === lib.id)!
    expect(s, 'extra is in the plan').toBeTruthy()
    expect(s.must).toBe(true); expect(s.cost).toBe(0); expect(s.hours).toBeUndefined()
    expect(s.address).toBe('31 Tràng Thi')
    expect(p.stops.length).toBeGreaterThan(1)                       // the app fills the rest around it
    expect(p.unmet).toBeUndefined()
  })
  it('works for every time length and in the rain', () => {
    for (const time of ['2h', 'half', 'full'] as const) for (const wx of [0, 61]) {
      const p = run(base({ extras: [lib], time }), wx)
      expect(p.stops.some(s => s.id === lib.id), `${time}/${wx}`).toBe(true)
    }
  })
  it('does not leak into plans that did not ask for it, and mixes with dataset picks within the limit', () => {
    expect(run(base()).stops.some(s => isExtraId(s.id))).toBe(false)
    const more = [lib, makeExtra({ name: 'B', lat: 21.03, lng: 105.85 }), makeExtra({ name: 'C', lat: 21.031, lng: 105.851 }), makeExtra({ name: 'D', lat: 21.032, lng: 105.852 })]
    const p = run(base({ extras: more, must: ['HK001'] }))
    expect(p.stops.filter(s => s.must).length).toBeLessThanOrEqual(MAX_MUST)
  })
  it('swapping another stop keeps the extra place', () => {
    const a = base({ extras: [lib] }), p = run(a)
    const other = p.stops.find(s => s.id !== lib.id)!
    const out = swapStop({ answers: a, wx: null, result: p, stopId: other.id, now: NOW })
    if (out) expect(out.stops.some(s => s.id === lib.id)).toBe(true)
  })
})
