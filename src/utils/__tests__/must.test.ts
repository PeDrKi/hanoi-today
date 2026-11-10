import { describe, it, expect } from 'vitest'
import { recommend, selectPlaces, STOPS_COUNT, MAX_MUST, swapStop } from '../recommend'
import { getPlaces } from '../../data/placeStore'
import { isOpen } from '../../data/schedule'
import type { Answers, Plan } from '../../types'

const NOW = new Date(2026, 10, 11, 8, 0)        // Wed 11 Nov 2026, 08:00
const base = (o: Partial<Answers> = {}): Answers => ({ mood: 'calm', budget: 1_000_000, people: 2, time: 'half', group: 'couple', mode: 'tourist', focus: 'all', startHour: 8, ...o })
const run = (a: Answers, wxCode = 0, now = NOW): Plan => recommend({ answers: a, wx: wxCode ? ({ code: wxCode, temp: 24 } as never) : null, now })
const places = getPlaces().filter(p => p.type !== 'lodging')
const ids = (p: Plan) => p.stops.map(s => s.id)

describe('places the visitor pinned to the plan', () => {
  it('without picks nothing changes: no flags, no unmet', () => {
    const p = run(base()); expect(p.unmet).toBeUndefined(); expect(p.stops.every(s => !s.must)).toBe(true)
  })
  it('a picked place is always in the plan, flagged, with the "must" reason first', () => {
    const open = places.filter(p => isOpen(p.id, NOW, 9))
    for (const pick of open.slice(0, 25)) {
      const p = run(base({ must: [pick.id] }))
      expect(ids(p), pick.id).toContain(pick.id)
      const s = p.stops.find(x => x.id === pick.id)!
      expect(s.must).toBe(true); expect(s.why[0]).toEqual({ k: 'must' })
      expect(p.stops.filter(x => x.must)).toHaveLength(1)
    }
  })
  it('the rest of the plan is built around it (fillers are near a picked place)', () => {
    const pick = places.find(p => p.id === 'BD004') ?? places[0]
    const p = run(base({ must: [pick.id] }))
    const radius = STOPS_COUNT.half.radius
    const near = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => Math.hypot((a.lat - b.lat) * 111, (a.lng - b.lng) * 104)
    for (const s of p.stops) expect(near(s, pick), s.id).toBeLessThanOrEqual(radius + 1)
    expect(p.stops.length).toBeGreaterThan(1)
  })
  it('a place the filters would drop is still kept, with a note saying why', () => {
    const dear = [...places].sort((a, b) => b.cost - a.cost).find(p => p.cost > 0 && isOpen(p.id, NOW, 9))!
    const p = run(base({ must: [dear.id], budget: 40_000, people: 2 }))        // 20.000đ each: far below this place's price
    const s = p.stops.find(x => x.id === dear.id)
    expect(s, 'dear place kept').toBeTruthy(); expect(s!.mustNotes).toContain('budget')
    const out = places.find(x => x.type === 'nature' && x.cost === 0 && !x.indoor && isOpen(x.id, NOW, 9))
    if (out) { const r = run(base({ must: [out.id] }), 65); expect(ids(r)).toContain(out.id); expect(r.stops.find(x => x.id === out.id)!.mustNotes).toContain('weather') }
  })
  it('up to 3 picks are kept together; extras beyond 3 are ignored; duplicates collapse', () => {
    const [a, b, c, d] = places.filter(p => isOpen(p.id, NOW, 9) && p.area === 'Hoàn Kiếm' || p.area === 'Ba Đình').slice(0, 4)
    const p = run(base({ must: [a.id, b.id, c.id, d.id, a.id], time: 'full' }))
    expect(p.stops.filter(s => s.must).length).toBeLessThanOrEqual(MAX_MUST)
    expect(new Set(ids(p)).size).toBe(p.stops.length)
  })
  it('a place that is closed that day is reported, not silently dropped', () => {
    let found: { id: string; date: Date } | null = null
    for (const pl of places) for (let d = 0; d < 7 && !found; d++) {
      const date = new Date(2026, 10, 9 + d, 8)
      if ([9, 12, 17].every(h => !isOpen(pl.id, date, h))) found = { id: pl.id, date }
    }
    if (!found) return          // dataset has no weekly closures: nothing to test
    const p = run(base({ must: [found.id] }), 0, found.date)
    expect(ids(p)).not.toContain(found.id)
    expect(p.unmet).toEqual([{ id: found.id, name: places.find(x => x.id === found.id)!.name, reason: 'closed' }])
  })
  it('hiding or swapping a picked place away is respected', () => {
    const pick = places.find(p => isOpen(p.id, NOW, 9))!
    expect(ids(run(base({ must: [pick.id], hidden: [pick.id] })))).not.toContain(pick.id)
    const p = run(base({ must: [pick.id] }))
    const swapped = swapStop({ answers: base({ must: [pick.id] }), wx: null, result: p, stopId: pick.id, now: NOW })
    if (swapped) expect(ids(swapped)).not.toContain(pick.id)
  })
  it('selectPlaces puts the picks first even if they score worst', () => {
    const scored = places.slice(0, 12).map((pl, i) => ({ place: pl, score: 100 - i }))
    const worst = scored[scored.length - 1].place
    const sel = selectPlaces(scored, 'half', 'all', null, [worst])
    expect(sel[0].id).toBe(worst.id)
  })
  it('fuzz: 300 random plans — every pick is in the plan or listed as unmet; no duplicates; plan never empty', () => {
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32
    const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
    for (let i = 0; i < 300; i++) {
      const must = [...new Set(Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => pick(places).id))]
      const a = base({ must, mood: pick(['calm', 'adventure', 'nostalgia', 'energy'] as const), group: pick(['solo', 'couple', 'friends', 'family'] as const), time: pick(['2h', 'half', 'full'] as const), budget: pick([100_000, 400_000, 2_000_000]), people: 1 + Math.floor(rnd() * 4), startHour: pick([7, 9, 13, 16]), seed: i })
      const p = run(a, pick([0, 0, 3, 61]))
      expect(p.stops.length, JSON.stringify(a)).toBeGreaterThan(0)
      expect(new Set(ids(p)).size).toBe(p.stops.length)
      for (const id of must.slice(0, STOPS_COUNT[a.time].target)) expect(ids(p).includes(id) || (p.unmet ?? []).some(u => u.id === id), `${id} lost in ${JSON.stringify(a)}`).toBe(true)
    }
  })
})
