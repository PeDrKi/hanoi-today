import { describe, it, expect, beforeEach } from 'vitest'
import { handle, RATE_LIMIT, type Admin } from '../../../sync-server/handler'
import { d1Api, type Api } from '../../../sync-server/db'
import { sqliteD1 } from '../../../sync-server/sqlite-shim'
import { applyMine, clampStars, fmtAvg, rate, __resetRatings, __getRatings, getDevice } from '../ratings'
import { topPicksByType, bayes, PICK_WEIGHTS } from '../topPicks'
import type { Place } from '../../types'

const ADMINS: Admin[] = [{ name: 'chu', token: 'secret-token', role: 'editor' }, { name: 'ban', token: 'viewer-token-1', role: 'viewer' }]
let api: Api
beforeEach(() => { api = d1Api(sqliteD1()) })
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, ip = '') =>
  handle(new Request('http://x' + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), api, { admins: ADMINS, ip })
const put = (id: string, device: string, stars: unknown, ip = '') => call('PUT', '/v1/rate/' + id, { device, stars }, {}, ip)
const D1 = 'device-aaaa-1111', D2 = 'device-bbbb-2222', D3 = 'device-cccc-3333'

describe('place rating API', () => {
  it('stores one rating per device per place, changeable, and averages across devices', async () => {
    expect((await put('HK001', D1, 5)).status).toBe(200)
    expect((await put('HK001', D2, 3)).status).toBe(200)
    expect((await put('HK001', D2, 4)).status).toBe(200)          // D2 changes its mind: still 2 ratings
    expect((await put('HK002', D1, 2)).status).toBe(200)
    const g = await call('GET', '/v1/ratings'); expect(g.status).toBe(200)
    expect((await g.json()).ratings).toEqual({ HK001: { avg: 4.5, n: 2 }, HK002: { avg: 2, n: 1 } })
    expect(g.headers.get('cache-control')).toContain('max-age=120')
  })
  it('rejects bad stars, devices and ids', async () => {
    for (const s of [0, 6, 2.5, '5', null, undefined]) expect((await put('HK001', D1, s)).status).toBe(400)
    expect((await put('HK001', 'short', 3)).status).toBe(400)
    expect((await put('HK001', 'has space device', 3)).status).toBe(400)
    expect((await call('PUT', '/v1/rate/' + 'x'.repeat(30), { device: D1, stars: 3 })).status).toBeGreaterThanOrEqual(400)
    expect((await call('GET', '/v1/ratings')).status).toBe(200)
    expect((await (await call('GET', '/v1/ratings')).json()).ratings).toEqual({})
  })
  it('limits one visitor to RATE_LIMIT ratings per hour', async () => {
    for (let i = 0; i < RATE_LIMIT; i++) expect((await put('P' + i, D1, 4, '1.2.3.4')).status).toBe(200)
    expect((await put('PX', D1, 4, '1.2.3.4')).status).toBe(429)
    expect((await put('PX', D1, 4, '5.6.7.8')).status).toBe(200)  // someone else is not affected
  })
  it('only an editor can clear a place\'s ratings, and it is audited', async () => {
    await put('HK001', D1, 1); await put('HK001', D2, 1); await put('HK002', D1, 5)
    expect((await call('DELETE', '/v1/admin/ratings/HK001')).status).toBe(401)
    expect((await call('DELETE', '/v1/admin/ratings/HK001', undefined, { authorization: 'Bearer viewer-token-1' })).status).toBe(403)
    const r = await call('DELETE', '/v1/admin/ratings/HK001', undefined, { authorization: 'Bearer secret-token' })
    expect(await r.json()).toEqual({ removed: 2 })
    expect((await (await call('GET', '/v1/ratings')).json()).ratings).toEqual({ HK002: { avg: 5, n: 1 } })
    expect((await api.listAudit(5)).map(e => e.action)).toContain('rating.clear')
  })
})

describe('client rating store', () => {
  it('applyMine: first vote adds, a changed vote keeps n', () => {
    expect(applyMine(undefined, undefined, 5)).toEqual({ avg: 5, n: 1 })
    expect(applyMine({ avg: 4, n: 2 }, undefined, 1)).toEqual({ avg: 3, n: 3 })
    expect(applyMine({ avg: 4, n: 2 }, 5, 3)).toEqual({ avg: 3, n: 2 })
  })
  it('clamps, formats, and keeps a stable device id', () => {
    expect(clampStars(0)).toBe(1); expect(clampStars(9)).toBe(5); expect(clampStars(3.4)).toBe(3)
    expect(fmtAvg(4.26)).toBe('4,3'); expect(fmtAvg(4.26, 'en')).toBe('4.3')
    expect(getDevice()).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })
  it('rate() updates your stars and the visible average right away', () => {
    __resetRatings({}, { A: { avg: 4, n: 2 } })
    rate('A', 2)
    rate('A', 4)       // changed mind
    rate('B', 5)
    expect(__getRatings().mine).toEqual({ A: 4, B: 5 })
    expect(__getRatings().aggs.A).toEqual({ avg: 4, n: 3 })     // 2 votes (sum 8) + my first vote 2 = 10/3, then changed to 4: (10-2+4)/3
    expect(__getRatings().aggs.B).toEqual({ avg: 5, n: 1 })
  })
})

const mk = (id: string, o: Partial<Place> = {}): Place => ({ id, name: id, area: 'Hoàn Kiếm', lat: 21.03, lng: 105.85, type: 'food', moods: ['calm'], groups: ['solo'], indoor: false, timeOfDay: ['morning'], duration: 60, cost: 0, desc: 'x'.repeat(30), badges: ['a'], tip: 't', ...o })
describe('ratings in "Đáng đến nhất"', () => {
  const ok = () => 'ok' as const
  it('many good votes beat a single 5★ and beat unrated; many bad votes sink a place; ⭐ editor still wins', () => {
    const ps = [mk('ONE'), mk('MANY'), mk('NONE'), mk('BAD'), mk('STAR', { featured: true })]
    const ratings = { ONE: { avg: 5, n: 1 }, MANY: { avg: 4.6, n: 20 }, BAD: { avg: 1.8, n: 20 }, STAR: { avg: 2, n: 30 } }
    const [g] = topPicksByType(ps, ok, 5, undefined, ratings)
    expect(g.picks.map(k => k.place.id)).toEqual(['STAR', 'MANY', 'ONE', 'NONE', 'BAD'])
    expect(g.picks[1].reasons).toContain('rated'); expect(g.picks[2].reasons).not.toContain('rated')   // 1 vote is shown but not "highly rated"
    expect(g.picks[1].rating).toEqual({ avg: 4.6, n: 20 })
  })
  it('weights are as documented', () => {
    expect(bayes({ avg: 4, n: 0 })).toBeCloseTo(3.5)
    expect(bayes({ avg: 5, n: 5 })).toBeCloseTo(4.25)
    const [g] = topPicksByType([mk('A')], ok, 1, undefined, { A: { avg: 5, n: 5 } })
    const [h] = topPicksByType([mk('A')], ok, 1)
    expect(g.picks[0].score - h.picks[0].score).toBeCloseTo((4.25 - 3.5) * PICK_WEIGHTS.rating, 5)
  })
})
