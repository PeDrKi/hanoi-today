// Storage layer. One SQL implementation (D1 / SQLite) used by the Worker in production and, through a small
// adapter over node:sqlite, by the dev server and the tests — so the real SQL is what gets tested.

/** The subset of Cloudflare's D1 API that we use. */
export interface D1Result { meta: { changes?: number } }
export interface D1Statement {
  bind(...values: unknown[]): D1Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<D1Result>
}
export interface D1Like { prepare(sql: string): D1Statement; batch(stmts: D1Statement[]): Promise<D1Result[]> }

export interface SyncRecord { rev: number; data: string | null }
export type PutResult = { ok: true; rev: number } | { ok: false; cur: SyncRecord }

export interface Api {
  getSync(id: string): Promise<SyncRecord | null>
  /** Atomic compare-and-set: succeeds only when `expectedRev` is the stored revision (0 = nothing stored yet). */
  putSync(id: string, expectedRev: number, data: string): Promise<PutResult>
  listPlaces(): Promise<unknown[]>
  replacePlaces(list: { id: string }[]): Promise<void>
  addReview(json: string): Promise<'ok' | 'full'>
  listReviews(limit: number): Promise<unknown[]>
  deleteReview(id: number): Promise<boolean>
  stats(): Promise<Stats>
  audit(actor: string, action: string, detail: string): Promise<void>
  listAudit(limit: number): Promise<AuditEntry[]>
  putImage(id: string, mime: string, bytes: Uint8Array): Promise<'ok' | 'full'>
  getImage(id: string): Promise<{ mime: string; bytes: Uint8Array } | null>
  deleteImage(id: string): Promise<boolean>
  /** Count one hit for `key` in the current time window; false when the limit is exceeded. */
  hit(key: string, limit: number, windowMs: number): Promise<boolean>
}

export interface Stats { syncDevices: number; active7d: number; active30d: number; reviews: number; reviews7d: number; places: number }
export interface AuditEntry { id: number; at: number; actor: string; action: string; detail: string }

export const SYNC_TTL_MS = 365 * 24 * 3600 * 1000
export const MAX_REVIEWS = 50000
export const MAX_IMAGES = 600

function toB64(b: Uint8Array): string { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s) }
function fromB64(s: string): Uint8Array { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out }

export function d1Api(db: D1Like, now: () => number = Date.now): Api {
  const getSync = async (id: string): Promise<SyncRecord | null> => {
    const r = await db.prepare('SELECT rev, data FROM sync WHERE id = ?').bind(id).first<{ rev: number; data: string }>()
    return r ? { rev: r.rev, data: r.data } : null
  }
  return {
    getSync,
    async putSync(id, expectedRev, data) {
      const t = now()
      const res = expectedRev === 0
        ? await db.prepare('INSERT INTO sync (id, rev, data, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id, data, t).run()
        : await db.prepare('UPDATE sync SET rev = rev + 1, data = ?, updated_at = ? WHERE id = ? AND rev = ?').bind(data, t, id, expectedRev).run()
      if ((res.meta.changes ?? 0) === 1) {
        if (Math.random() < 0.02) await db.prepare('DELETE FROM sync WHERE updated_at < ?').bind(t - SYNC_TTL_MS).run()
        return { ok: true, rev: expectedRev + 1 }
      }
      return { ok: false, cur: (await getSync(id)) || { rev: 0, data: null } }
    },
    async listPlaces() {
      const { results } = await db.prepare('SELECT json FROM places ORDER BY sort, id').all<{ json: string }>()
      return results.map(r => JSON.parse(r.json))
    },
    async replacePlaces(list) {
      const t = now()
      const stmts = [db.prepare('DELETE FROM places')]
      list.forEach((p, i) => stmts.push(db.prepare('INSERT INTO places (id, sort, json, updated_at) VALUES (?, ?, ?, ?)').bind(p.id, i, JSON.stringify(p), t)))
      await db.batch(stmts)   // D1 runs a batch as one transaction
    },
    async addReview(json) {
      const n = await db.prepare('SELECT COUNT(*) AS n FROM reviews').first<{ n: number }>()
      if ((n?.n ?? 0) >= MAX_REVIEWS) return 'full'
      await db.prepare('INSERT INTO reviews (created_at, json) VALUES (?, ?)').bind(now(), json).run()
      return 'ok'
    },
    async deleteReview(id) {
      const r = await db.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run()
      return (r.meta.changes ?? 0) === 1
    },
    async stats() {
      const t = now(), day = 24 * 3600 * 1000
      const one = async (sql: string, ...a: unknown[]) => ((await db.prepare(sql).bind(...a).first<{ n: number }>())?.n ?? 0)
      return {
        syncDevices: await one('SELECT COUNT(*) AS n FROM sync'),
        active7d: await one('SELECT COUNT(*) AS n FROM sync WHERE updated_at >= ?', t - 7 * day),
        active30d: await one('SELECT COUNT(*) AS n FROM sync WHERE updated_at >= ?', t - 30 * day),
        reviews: await one('SELECT COUNT(*) AS n FROM reviews'),
        reviews7d: await one('SELECT COUNT(*) AS n FROM reviews WHERE created_at >= ?', t - 7 * day),
        places: await one('SELECT COUNT(*) AS n FROM places'),
      }
    },
    async audit(actor, action, detail) {
      await db.prepare('INSERT INTO audit_log (at, actor, action, detail) VALUES (?, ?, ?, ?)').bind(now(), actor.slice(0, 40), action.slice(0, 40), detail.slice(0, 500)).run()
    },
    async listAudit(limit) {
      const { results } = await db.prepare('SELECT id, at, actor, action, detail FROM audit_log ORDER BY id DESC LIMIT ?').bind(limit).all<AuditEntry>()
      return results
    },
    async hit(key, limit, windowMs) {
      const win = Math.floor(now() / windowMs)
      await db.prepare('INSERT INTO rate (key, win, n) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET n = CASE WHEN win = excluded.win THEN n + 1 ELSE 1 END, win = excluded.win').bind(key, win).run()
      if (Math.random() < 0.02) await db.prepare('DELETE FROM rate WHERE win < ?').bind(win - 1).run()
      const r = await db.prepare('SELECT n FROM rate WHERE key = ?').bind(key).first<{ n: number }>()
      return (r?.n ?? 1) <= limit
    },
    async putImage(id, mime, bytes) {
      const have = await db.prepare('SELECT 1 AS x FROM images WHERE id = ?').bind(id).first()
      if (!have) {
        const n = await db.prepare('SELECT COUNT(*) AS n FROM images').first<{ n: number }>()
        if ((n?.n ?? 0) >= MAX_IMAGES) return 'full'
      }
      await db.prepare('INSERT INTO images (id, mime, data, bytes, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET mime = excluded.mime, data = excluded.data, bytes = excluded.bytes, updated_at = excluded.updated_at')
        .bind(id, mime, toB64(bytes), bytes.length, now()).run()
      return 'ok'
    },
    async getImage(id) {
      const r = await db.prepare('SELECT mime, data FROM images WHERE id = ?').bind(id).first<{ mime: string; data: string }>()
      return r ? { mime: r.mime, bytes: fromB64(r.data) } : null
    },
    async deleteImage(id) {
      const r = await db.prepare('DELETE FROM images WHERE id = ?').bind(id).run()
      return (r.meta.changes ?? 0) === 1
    },
    async listReviews(limit) {
      const { results } = await db.prepare('SELECT id, created_at, json FROM reviews ORDER BY id DESC LIMIT ?').bind(limit).all<{ id: number; created_at: number; json: string }>()
      return results.map(r => ({ ...JSON.parse(r.json), id: r.id, createdAt: r.created_at }))
    },
  }
}
