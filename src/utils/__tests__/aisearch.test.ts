import { describe, it, expect, beforeEach } from 'vitest'
import { handle, AI_LIMIT } from '../../../sync-server/handler'
import { d1Api, type Api } from '../../../sync-server/db'
import { sqliteD1 } from '../../../sync-server/sqlite-shim'
import { aiSearch, parseCandidates, nameMatch } from '../../../sync-server/aisearch'

let api: Api
beforeEach(() => { api = d1Api(sqliteD1()) })

// fake Gemini + Nominatim
const gemini = (list: unknown) => ({ candidates: [{ content: { parts: [{ text: typeof list === 'string' ? list : JSON.stringify(list) }] } }] })
const fakeFetch = (cands: unknown, osm: Record<string, unknown[]>, log: string[] = []) => (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url)
  log.push(u)
  if (u.includes('generativelanguage')) return new Response(JSON.stringify(gemini(cands)))
  const q = decodeURIComponent(/[?&]q=([^&]+)/.exec(u)![1])
  const key = Object.keys(osm).find(k => q.startsWith(k))
  void init
  return new Response(JSON.stringify(key ? osm[key] : []))
}) as unknown as typeof fetch
const noWait = async () => {}
const hit = (name: string, lat: number, lon: number) => ({ lat: String(lat), lon: String(lon), name, display_name: name + ', Hoàn Kiếm, Hà Nội', osm_type: 'node', osm_id: 1 })

describe('AI place search', () => {
  it('keeps verified places with OSM coordinates; drops invented, mismatched and out-of-area ones', async () => {
    const f = fakeFetch(
      [{ name: 'Cà phê Giảng', area: 'Hoàn Kiếm', category: 'cà phê', why: 'Cà phê trứng nổi tiếng' },
       { name: 'Quán Không Tồn Tại', area: 'Ba Đình', category: 'quán ăn', why: 'x' },
       { name: 'Bảo tàng Dân tộc học', area: 'Cầu Giấy', category: 'bảo tàng', why: 'y' },
       { name: 'Hồ Gươm', area: 'Hoàn Kiếm', category: 'hồ', why: 'z' }],
      { 'Cà phê Giảng': [hit('Cà phê Giảng', 21.0345, 105.8517)],
        'Bảo tàng Dân tộc học': [hit('Nhà hàng Khác Hẳn', 21.04, 105.8)],     // OSM returned something unrelated
        'Hồ Gươm': [hit('Hồ Gươm', 10.77, 106.7)] })                           // outside Hà Nội
    const r = await aiSearch('cà phê trứng', { key: 'k', fetchFn: f, sleep: noWait })
    expect(r.asked).toBe(4)
    expect(r.places.map(p => p.name)).toEqual(['Cà phê Giảng'])
    expect(r.places[0]).toMatchObject({ lat: 21.0345, lng: 105.8517, osm: 'https://www.openstreetmap.org/node/1' })
  })
  it('never trusts AI-supplied coordinates and sends the key as a header, not in the URL', async () => {
    const log: string[] = []
    const f = fakeFetch([{ name: 'Chùa Trấn Quốc', lat: 1, lng: 2, area: 'Tây Hồ', category: 'chùa', why: 'cổ' }], { 'Chùa Trấn Quốc': [hit('Chùa Trấn Quốc', 21.0486, 105.8365)] }, log)
    const r = await aiSearch('chùa cổ', { key: 'SECRET', fetchFn: f, sleep: noWait })
    expect(r.places[0].lat).toBe(21.0486)
    expect(log.every(u => !u.includes('SECRET'))).toBe(true)
  })
  it('parses defensively', () => {
    expect(parseCandidates('not json')).toEqual([])
    expect(parseCandidates('```json\n[{"name":"A b","why":"<script>x</script>"}]\n```')[0].why).not.toContain('<')
    expect(parseCandidates(JSON.stringify({ places: [{ name: 'Hồ Tây' }] }))).toHaveLength(1)
    expect(parseCandidates('[{"name":""},null,5]')).toEqual([])
  })
  it('nameMatch ignores accents and case', () => {
    expect(nameMatch('Chùa Trấn Quốc', 'chua tran quoc, Tây Hồ')).toBe(1)
    expect(nameMatch('Quán Không Tồn Tại', 'Nhà hàng Khác Hẳn')).toBeLessThan(0.6)
  })
})

describe('AI place search with Google Maps', () => {
  const gm = (places: unknown[], status = 200) => (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    if (u.includes('generativelanguage')) return new Response(JSON.stringify(gemini([{ name: 'Cà phê Giảng', area: 'Hoàn Kiếm', category: 'cà phê', why: 'a' }, { name: 'Quán Đã Đóng', area: 'x', category: 'y', why: 'z' }, { name: 'Quán Ma', area: 'x', category: 'y', why: 'z' }])))
    expect((init?.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('MAPSKEY')
    const body = JSON.parse(String(init?.body))
    const q = body.textQuery as string
    if (status !== 200) return new Response(JSON.stringify({ error: { message: 'API not enabled' } }), { status })
    return new Response(JSON.stringify({ places: q.startsWith('Quán Ma') ? [] : places.filter(p => (p as { n: string }).n === (q.startsWith('Quán Đã') ? 'Quán Đã Đóng' : 'Cà phê Giảng')).map(p => { const x = p as { n: string; st: string }; return { displayName: { text: x.n }, formattedAddress: '39 Nguyễn Hữu Huân', location: { latitude: 21.0345, longitude: 105.8517 }, googleMapsUri: 'https://maps.google.com/?cid=1', businessStatus: x.st } }) }))
  }) as unknown as typeof fetch
  it('uses Google coordinates, skips permanently closed and unknown places', async () => {
    const r = await aiSearch('cà phê', { key: 'k', mapsKey: 'MAPSKEY', fetchFn: gm([{ n: 'Cà phê Giảng', st: 'OPERATIONAL' }, { n: 'Quán Đã Đóng', st: 'CLOSED_PERMANENTLY' }]) })
    expect(r.places.map(p => p.name)).toEqual(['Cà phê Giảng'])
    expect(r.places[0]).toMatchObject({ source: 'google', lat: 21.0345, lng: 105.8517, maps: 'https://maps.google.com/?cid=1' })
  })
  it('refuses a non-Google maps link and reports Google errors', async () => {
    const f = (async (url: string | URL | Request) => String(url).includes('generativelanguage')
      ? new Response(JSON.stringify(gemini([{ name: 'Cà phê Giảng' }])))
      : new Response(JSON.stringify({ places: [{ displayName: { text: 'Cà phê Giảng' }, location: { latitude: 21.03, longitude: 105.85 }, googleMapsUri: 'https://evil.example/x' }] }))) as unknown as typeof fetch
    expect((await aiSearch('cà phê', { key: 'k', mapsKey: 'MAPSKEY', fetchFn: f })).places[0].maps).toBeUndefined()
    await expect(aiSearch('cà phê', { key: 'k', mapsKey: 'MAPSKEY', fetchFn: gm([], 403) })).rejects.toThrow(/Google Maps 403: API not enabled/)
  })
})

describe('/v1/ai/search route', () => {
  const post = (body: unknown, o: Record<string, unknown> = {}, ip = '') =>
    handle(new Request('http://x/v1/ai/search', { method: 'POST', body: JSON.stringify(body) }), api, { aiKey: 'k', aiFetch: fakeFetch([], {}), ip, ...o })
  it('reports whether it is enabled; 503 when no key', async () => {
    const g = (aiKey: string) => handle(new Request('http://x/v1/ai/search'), api, { aiKey })
    expect((await (await g('k')).json()).enabled).toBe(true)
    expect((await (await g('')).json()).enabled).toBe(false)
    expect((await post({ q: 'cà phê' }, { aiKey: '' })).status).toBe(503)
  })
  it('validates the query', async () => {
    expect((await post({ q: 'a' })).status).toBe(400)
    expect((await post({ q: 'x'.repeat(201) })).status).toBe(400)
    expect((await post({ q: 5 })).status).toBe(400)
    expect((await post({ q: 'quán cà phê' })).status).toBe(200)
  })
  it('rate-limits per visitor', async () => {
    for (let i = 0; i < AI_LIMIT; i++) expect((await post({ q: 'quán cà phê' }, {}, '1.2.3.4')).status).toBe(200)
    expect((await post({ q: 'quán cà phê' }, {}, '1.2.3.4')).status).toBe(429)
    expect((await post({ q: 'quán cà phê' }, {}, '5.6.7.8')).status).toBe(200)
  })
  it('502 when Gemini fails', async () => {
    const bad = (async () => new Response('x', { status: 500 })) as unknown as typeof fetch
    expect((await post({ q: 'quán cà phê' }, { aiFetch: bad })).status).toBe(502)
  })
})
