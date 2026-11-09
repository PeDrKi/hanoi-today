// Cloudflare Worker (free plan) — deploy with `npx wrangler deploy` from the sync-server folder.
// Needs a D1 database bound as DB (see wrangler.toml + schema.sql) and a secret ADMIN_TOKENS (`npx wrangler secret put ADMIN_TOKENS`, format name:token:role,…) or the older single ADMIN_TOKEN.
// Optional: an R2 bucket bound as IMAGES keeps uploaded photos there; without it they go into the D1 table `images`.
import { handle, parseAdmins, type BlobStore } from './handler'
import { d1Api, type D1Like } from './db'

interface R2Obj { httpMetadata?: { contentType?: string }; arrayBuffer(): Promise<ArrayBuffer> }
interface R2Like {
  put(key: string, value: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>
  get(key: string): Promise<R2Obj | null>
  delete(key: string): Promise<void>
}
interface Env { DB: D1Like; IMAGES?: R2Like; ADMIN_TOKENS?: string; ADMIN_TOKEN?: string; ALLOWED_ORIGIN?: string }

const r2Store = (b: R2Like): BlobStore => ({
  async put(id, mime, bytes) { await b.put('places/' + id, bytes, { httpMetadata: { contentType: mime } }); return 'ok' },
  async get(id) { const o = await b.get('places/' + id); return o ? { mime: o.httpMetadata?.contentType || 'image/jpeg', bytes: new Uint8Array(await o.arrayBuffer()) } : null },
  async del(id) { await b.delete('places/' + id); return true },
})

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, d1Api(env.DB), {
      origin: (env.ALLOWED_ORIGIN || '*').trim().replace(/\/+$/, ''), admins: parseAdmins(env.ADMIN_TOKENS, env.ADMIN_TOKEN),
      ip: request.headers.get('CF-Connecting-IP') || '', blobs: env.IMAGES ? r2Store(env.IMAGES) : undefined,
    })
  },
}
