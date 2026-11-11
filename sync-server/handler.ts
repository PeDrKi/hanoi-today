// HTTP API (runs as a Cloudflare Worker; same code in tests and the local dev server).
//
//   Personal data (end-to-end encrypted; the server only sees an id hash + a blob)
//     GET  /v1/:id            → 200 { rev, data }        (rev 0 / data null when nothing is stored yet)
//     PUT  /v1/:id {rev,data} → 200 { rev }              (409 { rev, data } when rev is stale → client merges and retries)
//   Places
//     GET  /v1/places                → 200 { places }                    public
//     PUT  /v1/admin/places {places} → 200 { count }                     editor
//   Reviews
//     POST /v1/reviews {…}           → 201 { ok:true }                   public, validated, size-limited, 5 per hour per visitor
//     GET  /v1/admin/reviews?limit=  → 200 { reviews }                   viewer
//     DELETE /v1/admin/reviews/:id   → 200 { ok:true }                   editor
//   Admin
//     GET  /v1/admin/me              → 200 { name, role }                any admin (also used to check a token)
//     GET  /v1/admin/stats           → 200 { stats }                     viewer
//     GET  /v1/admin/audit?limit=    → 200 { entries }                   viewer
//   Place ratings (1–5 stars, one per anonymous device per place, changeable)
//     PUT  /v1/rate/:placeId  {device, stars}  → 200 { ok:true }         public, 60 per hour per visitor
//     GET  /v1/ratings                         → 200 { ratings:{id:{avg,n}} }   public, cached 2 min
//     DELETE /v1/admin/ratings/:placeId        → 200 { removed }         editor (clears spam for one place)
//   Photos
//     GET  /v1/img/:placeId          → image bytes                       public, cached
//     PUT  /v1/admin/img/:placeId    → 200 { url, bytes }                editor; body = the image itself (jpeg/png/webp, ≤ 450 KB)
//     DELETE /v1/admin/img/:placeId  → 200 { ok:true }                   editor
//   Stored in the R2 bucket IMAGES when one is bound, otherwise in the D1 table `images`.
//   Admins are configured with the secret ADMIN_TOKENS = "name:token[:role],…" (role: viewer | editor, default editor);
//   the older single secret ADMIN_TOKEN still works and means editor "admin".
import type { Api } from './db'

export type { SyncRecord as Record_ } from './db'

const ID_RE = /^[a-f0-9]{64}$/
const DATA_RE = /^[A-Za-z0-9+/=_-]*$/
export const MAX_DATA = 60000
export const MAX_PLACES = 500
import { aiSearch, MAX_QUERY } from './aisearch'
export const MAX_PLACE_BYTES = 8000
export const MAX_REVIEW_BYTES = 4000
export const MAX_IMAGE_BYTES = 450_000
export const RATE_LIMIT = 60                   // place ratings per visitor per hour
export const REVIEW_LIMIT = 5                 // reviews per visitor …
export const AI_LIMIT = 10                      // AI place searches per visitor per hour
export const REVIEW_WINDOW_MS = 3600 * 1000   // … per hour

export type Role = 'viewer' | 'editor'
export interface Admin { name: string; token: string; role: Role }

/** "alice:token1:editor, bob:token2:viewer"  (+ legacy single token). Entries with tokens shorter than 8 chars are ignored. */
export function parseAdmins(spec = '', legacyToken = ''): Admin[] {
  const out: Admin[] = []
  for (const part of spec.split(/[,\n]/)) {
    const [name, token, role] = part.trim().split(':').map(x => x?.trim())
    if (!name || !token || token.length < 8 || !/^[\w .-]{1,40}$/.test(name)) continue
    out.push({ name, token, role: role === 'viewer' ? 'viewer' : 'editor' })
  }
  if (legacyToken.length >= 8) out.push({ name: 'admin', token: legacyToken, role: 'editor' })
  return out
}

export function cors(origin = '*'): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const strArr = (x: unknown) => Array.isArray(x) && x.every(s => typeof s === 'string')

/** Same rules the app applies to places it loads: reject anything the recommender could choke on. */
export function validPlace(p: unknown): p is { id: string } & Record<string, unknown> {
  if (!isObj(p)) return false
  return typeof p.id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(p.id)
    && typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 200
    && Number.isFinite(p.lat) && Number.isFinite(p.lng)
    && strArr(p.moods) && strArr(p.groups) && strArr(p.timeOfDay)
    && typeof p.type === 'string'
    && Number.isFinite(p.cost) && Number.isFinite(p.duration)
}

/** Keep only known review fields, clamp lengths and ratings. Returns null when it is not a review at all. */
export function cleanReview(x: unknown): Record<string, unknown> | null {
  if (!isObj(x) || !isObj(x.ratings)) return null
  const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '')
  const ratings: Record<string, number> = {}
  for (const k of ['overall', 'relevance', 'accuracy', 'usability']) {
    const v = Number((x.ratings as Record<string, unknown>)[k])
    ratings[k] = Number.isFinite(v) ? Math.min(5, Math.max(0, Math.round(v))) : 0
  }
  if (ratings.overall < 1) return null
  // optional SUS answers (exactly 10 integers 1–5) and context-factor answers (1–5)
  const susRaw = Array.isArray(x.sus) ? x.sus.map(Number) : null
  const sus = susRaw && susRaw.length === 10 && susRaw.every(n => Number.isInteger(n) && n >= 1 && n <= 5) ? susRaw : undefined
  const ctx: Record<string, number> = {}
  if (isObj(x.ctx)) for (const k of ['mood', 'weather', 'time', 'budget', 'intent']) { const v = Number((x.ctx as Record<string, unknown>)[k]); if (Number.isInteger(v) && v >= 1 && v <= 5) ctx[k] = v }
  return {
    ...(sus ? { sus } : {}), ...(Object.keys(ctx).length ? { ctx } : {}),
    date: s(x.date, 40), mood: s(x.mood, 20), timeLabel: s(x.timeLabel, 60), groupLabel: s(x.groupLabel, 60), budgetLabel: s(x.budgetLabel, 60),
    ratings, comment: s(x.comment, 1000),
    stops: Array.isArray(x.stops) ? x.stops.filter((v): v is string => typeof v === 'string').slice(0, 12).map(v => v.slice(0, 120)) : [],
  }
}

function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

/** Where photos live. Default = the D1 table through `api`; the Worker passes an R2 store when a bucket is bound. */
export interface BlobStore {
  put(id: string, mime: string, bytes: Uint8Array): Promise<'ok' | 'full'>
  get(id: string): Promise<{ mime: string; bytes: Uint8Array } | null>
  del(id: string): Promise<boolean>
}
const PLACE_ID_RE = /^[A-Za-z0-9_-]{1,24}$/

/** The real type from the first bytes (the Content-Type header is not trusted). SVG is deliberately not allowed. */
export function sniffImage(b: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  return null
}

export interface HandleOpts { /** Gemini key for /v1/ai/search; without it the route answers 503 and the app hides the feature */ aiKey?: string; aiModel?: string; aiFetch?: typeof fetch; blobs?: BlobStore; origin?: string; admins?: Admin[]; /** visitor address, used only to rate-limit (stored as a salted hash) */ ip?: string }

async function hashIp(ip: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('hanoi-today:ip:' + ip))
  return [...new Uint8Array(buf)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function handle(request: Request, api: Api, { origin = '*', admins = [], ip = '', blobs, aiKey = '', aiModel, aiFetch }: HandleOpts = {}): Promise<Response> {
  const store: BlobStore = blobs ?? { put: (id, mime, b) => api.putImage(id, mime, b), get: id => api.getImage(id), del: id => api.deleteImage(id) }
  const h = { ...cors(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  const json = (obj: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(obj), { status, headers: { ...h, ...extra } })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h })

  const url = new URL(request.url)
  const path = url.pathname

  const readBody = async (max: number): Promise<unknown | Response> => {
    const len = Number(request.headers.get('content-length') || 0)
    if (len > max) return json({ error: 'too large' }, 413)
    let text: string
    try { text = await request.text() } catch { return json({ error: 'bad body' }, 400) }
    if (text.length > max) return json({ error: 'too large' }, 413)
    try { return JSON.parse(text) } catch { return json({ error: 'bad json' }, 400) }
  }
  /** Resolve the caller: an Admin, or the error response to return (503 disabled, 401 bad token, 403 role too low). */
  const admin = (need: Role = 'viewer'): Admin | Response => {
    if (!admins.length) return json({ error: 'admin disabled' }, 503)
    const m = /^Bearer (.+)$/.exec(request.headers.get('authorization') || '')
    let found: Admin | null = null
    if (m) for (const a of admins) if (sameToken(m[1], a.token)) found = a      // no early exit: constant work per request
    if (!found) return json({ error: 'unauthorized' }, 401)
    if (need === 'editor' && found.role !== 'editor') return json({ error: 'forbidden' }, 403)
    return found
  }

  // ── places ──
  if (path === '/v1/places' && request.method === 'GET') {
    return json({ places: await api.listPlaces() }, 200, { 'Cache-Control': 'public, max-age=60' })
  }
  if (path === '/v1/admin/places' && request.method === 'PUT') {
    const who = admin('editor'); if (who instanceof Response) return who
    const body = await readBody(MAX_PLACES * MAX_PLACE_BYTES)
    if (body instanceof Response) return body
    const list = isObj(body) ? body.places : null
    if (!Array.isArray(list) || list.length === 0 || list.length > MAX_PLACES) return json({ error: 'bad places' }, 400)
    const ids = new Set<string>()
    for (const p of list) {
      if (!validPlace(p) || JSON.stringify(p).length > MAX_PLACE_BYTES || ids.has(p.id)) return json({ error: 'bad place', id: isObj(p) ? p.id : null }, 400)
      ids.add(p.id)
    }
    const before = new Map((await api.listPlaces() as { id: string }[]).map(p => [p.id, JSON.stringify(p)]))
    const after = new Map((list as { id: string }[]).map(p => [p.id, JSON.stringify(p)]))
    const added = [...after.keys()].filter(k => !before.has(k)), removed = [...before.keys()].filter(k => !after.has(k))
    const changed = [...after.keys()].filter(k => before.has(k) && before.get(k) !== after.get(k))
    await api.replacePlaces(list as { id: string }[])
    await api.audit(who.name, 'places.save', `${list.length} địa điểm · thêm ${added.length}${added.length ? ' (' + added.slice(0, 5).join(', ') + ')' : ''} · sửa ${changed.length}${changed.length ? ' (' + changed.slice(0, 5).join(', ') + ')' : ''} · xoá ${removed.length}${removed.length ? ' (' + removed.slice(0, 5).join(', ') + ')' : ''}`)
    return json({ count: list.length })
  }

  // ── photos ──
  const img = /^\/v1\/img\/([A-Za-z0-9_-]{1,24})$/.exec(path)
  if (img && request.method === 'GET') {
    const f = await store.get(img[1])
    if (!f) return json({ error: 'not found' }, 404)
    return new Response(f.bytes, { status: 200, headers: {
      'Content-Type': f.mime, 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin',
      // the app adds ?v=<time> after every upload, so a versioned URL never changes and may be cached for a year
      'Cache-Control': url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    } })
  }
  const upl = /^\/v1\/admin\/img\/([^/]+)$/.exec(path)
  if (upl && request.method === 'PUT') {
    const who = admin('editor'); if (who instanceof Response) return who
    if (!PLACE_ID_RE.test(upl[1])) return json({ error: 'bad id' }, 400)
    if (Number(request.headers.get('content-length') || 0) > MAX_IMAGE_BYTES) return json({ error: 'too large' }, 413)
    let bytes: Uint8Array
    try { bytes = new Uint8Array(await request.arrayBuffer()) } catch { return json({ error: 'bad body' }, 400) }
    if (bytes.length > MAX_IMAGE_BYTES) return json({ error: 'too large' }, 413)
    const mime = sniffImage(bytes)
    if (!mime) return json({ error: 'not an image (jpeg, png or webp)' }, 415)
    if ((await store.put(upl[1], mime, bytes)) === 'full') return json({ error: 'full' }, 429)
    await api.audit(who.name, 'image.upload', `ảnh ${upl[1]} · ${Math.round(bytes.length / 1024)} KB`)
    return json({ url: '/v1/img/' + upl[1], bytes: bytes.length })
  }
  if (upl && request.method === 'DELETE') {
    const who = admin('editor'); if (who instanceof Response) return who
    if (!PLACE_ID_RE.test(upl[1])) return json({ error: 'bad id' }, 400)
    await store.del(upl[1])
    await api.audit(who.name, 'image.delete', `ảnh ${upl[1]}`)
    return json({ ok: true })
  }

  // ── place ratings ──
  if (path === '/v1/ai/search') {
    if (request.method === 'GET') return json({ enabled: !!aiKey }, 200, { 'Cache-Control': 'public, max-age=300' })
    if (request.method !== 'POST') return json({ error: 'method' }, 405)
    if (!aiKey) return json({ error: 'ai disabled' }, 503)
    const body = await readBody(1024)
    if (body instanceof Response) return body
    const q = (body as { q?: unknown })?.q
    if (typeof q !== 'string' || q.trim().length < 3 || q.length > MAX_QUERY) return json({ error: 'bad query' }, 400)
    if (ip && !(await api.hit('ai:' + (await hashIp(ip)), AI_LIMIT, REVIEW_WINDOW_MS))) return json({ error: 'too many' }, 429, { 'Retry-After': '3600' })
    try { return json(await aiSearch(q, { key: aiKey, model: aiModel, fetchFn: aiFetch })) } catch { return json({ error: 'ai failed' }, 502) }
  }
  const rate = /^\/v1\/rate\/([A-Za-z0-9_-]{1,24})$/.exec(path)
  if (rate && request.method === 'PUT') {
    const body = await readBody(512)
    if (body instanceof Response) return body
    const b = body as { device?: unknown; stars?: unknown }
    if (!isObj(b) || typeof b.device !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(b.device) || !Number.isInteger(b.stars) || (b.stars as number) < 1 || (b.stars as number) > 5) return json({ error: 'bad rating' }, 400)
    if (ip && !(await api.hit('rate:' + (await hashIp(ip)), RATE_LIMIT, REVIEW_WINDOW_MS))) return json({ error: 'too many' }, 429, { 'Retry-After': '3600' })
    return (await api.ratePlace(rate[1], b.device, b.stars as number)) === 'full' ? json({ error: 'full' }, 429) : json({ ok: true })
  }
  if (path === '/v1/ratings' && request.method === 'GET') return json({ ratings: await api.placeRatings() }, 200, { 'Cache-Control': 'public, max-age=120' })
  const delr = /^\/v1\/admin\/ratings\/([A-Za-z0-9_-]{1,24})$/.exec(path)
  if (delr && request.method === 'DELETE') {
    const who = admin('editor'); if (who instanceof Response) return who
    const removed = await api.deletePlaceRatings(delr[1])
    await api.audit(who.name, 'rating.clear', `xoá ${removed} lượt chấm của ${delr[1]}`)
    return json({ removed })
  }

  // ── reviews ──
  if (path === '/v1/reviews' && request.method === 'POST') {
    const body = await readBody(MAX_REVIEW_BYTES * 2)
    if (body instanceof Response) return body
    const review = cleanReview(body)
    if (!review) return json({ error: 'bad review' }, 400)
    if (ip && !(await api.hit('review:' + (await hashIp(ip)), REVIEW_LIMIT, REVIEW_WINDOW_MS))) return json({ error: 'too many' }, 429, { 'Retry-After': '3600' })
    const out = JSON.stringify(review)
    if (out.length > MAX_REVIEW_BYTES) return json({ error: 'too large' }, 413)
    return (await api.addReview(out)) === 'full' ? json({ error: 'full' }, 429) : json({ ok: true }, 201)
  }
  if (path === '/v1/admin/reviews' && request.method === 'GET') {
    const who = admin(); if (who instanceof Response) return who
    const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit')) || 500))
    return json({ reviews: await api.listReviews(limit) })
  }

  const del = /^\/v1\/admin\/reviews\/(\d{1,12})$/.exec(path)
  if (del && request.method === 'DELETE') {
    const who = admin('editor'); if (who instanceof Response) return who
    const ok = await api.deleteReview(Number(del[1]))
    if (!ok) return json({ error: 'not found' }, 404)
    await api.audit(who.name, 'review.delete', `đánh giá #${del[1]}`)
    return json({ ok: true })
  }

  // ── admin: who am I, numbers, history ──
  if (path === '/v1/admin/me' && request.method === 'GET') {
    const who = admin(); if (who instanceof Response) return who
    return json({ name: who.name, role: who.role })
  }
  if (path === '/v1/admin/stats' && request.method === 'GET') {
    const who = admin(); if (who instanceof Response) return who
    return json({ stats: await api.stats() })
  }
  if (path === '/v1/admin/audit' && request.method === 'GET') {
    const who = admin(); if (who instanceof Response) return who
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 100))
    return json({ entries: await api.listAudit(limit) })
  }

  // ── encrypted personal data ──
  const m = path.match(/^\/v1\/([^/]+)$/)
  if (!m || !ID_RE.test(m[1])) return json({ error: 'bad id' }, 400)
  const id = m[1]

  if (request.method === 'GET') {
    const cur = await api.getSync(id)
    return json(cur ? { rev: cur.rev, data: cur.data } : { rev: 0, data: null })
  }
  if (request.method === 'PUT') {
    const body = await readBody(MAX_DATA + 200)
    if (body instanceof Response) return body
    const b = body as { rev?: unknown; data?: unknown } | null
    if (!b || typeof b.rev !== 'number' || !Number.isInteger(b.rev) || b.rev < 0 || typeof b.data !== 'string' || b.data.length > MAX_DATA || !DATA_RE.test(b.data)) {
      return json({ error: 'bad body' }, 400)
    }
    const res = await api.putSync(id, b.rev, b.data)
    return res.ok ? json({ rev: res.rev }) : json({ rev: res.cur.rev, data: res.cur.data }, 409)
  }
  return json({ error: 'method not allowed' }, 405)
}
