import { describe, it, expect, beforeEach } from 'vitest'
import { handle, sniffImage, MAX_IMAGE_BYTES, type Admin, type BlobStore } from '../../../sync-server/handler'
import { d1Api, type Api } from '../../../sync-server/db'
import { sqliteD1 } from '../../../sync-server/sqlite-shim'
import { fitSize, normalizeImageUrl } from '../imageTools'

const ADMINS: Admin[] = [{ name: 'chu', token: 'secret-token', role: 'editor' }, { name: 'ban', token: 'viewer-token-1', role: 'viewer' }]
const asEditor = { authorization: 'Bearer secret-token' }
const asViewer = { authorization: 'Bearer viewer-token-1' }
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 2, 3, 4])
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72])
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 86, 80, 56])
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

let api: Api
beforeEach(() => { api = d1Api(sqliteD1()) })
const call = (method: string, path: string, body?: Uint8Array, headers: Record<string, string> = {}, blobs?: BlobStore) =>
  handle(new Request('http://x' + path, { method, headers, body: body as BodyInit | undefined }), api, { admins: ADMINS, blobs })

describe('photo upload API (D1 storage)', () => {
  it('sniffs the real type from the bytes and rejects SVG / text', () => {
    expect(sniffImage(JPEG)).toBe('image/jpeg'); expect(sniffImage(PNG)).toBe('image/png'); expect(sniffImage(WEBP)).toBe('image/webp')
    expect(sniffImage(SVG)).toBeNull(); expect(sniffImage(new Uint8Array([1, 2, 3]))).toBeNull()
  })
  it('editor uploads, anyone can read it back with the right type and long cache', async () => {
    const up = await call('PUT', '/v1/admin/img/HK001', JPEG, asEditor)
    expect(up.status).toBe(200); expect(await up.json()).toEqual({ url: '/v1/img/HK001', bytes: JPEG.length })
    const g = await call('GET', '/v1/img/HK001?v=123')
    expect(g.status).toBe(200); expect(g.headers.get('content-type')).toBe('image/jpeg')
    expect(g.headers.get('cache-control')).toContain('immutable'); expect(g.headers.get('x-content-type-options')).toBe('nosniff')
    expect([...new Uint8Array(await g.arrayBuffer())]).toEqual([...JPEG])
    expect((await call('GET', '/v1/img/HK001')).headers.get('cache-control')).toBe('public, max-age=300')
  })
  it('replacing keeps one row; png and webp work; the new bytes win', async () => {
    await call('PUT', '/v1/admin/img/A1', JPEG, asEditor); await call('PUT', '/v1/admin/img/A1', PNG, asEditor)
    const g = await call('GET', '/v1/img/A1'); expect(g.headers.get('content-type')).toBe('image/png')
    expect((await call('PUT', '/v1/admin/img/A2', WEBP, asEditor)).status).toBe(200)
    expect((await api.stats()).places).toBe(0)
  })
  it('refuses: no token, viewer, SVG, oversize, bad id', async () => {
    expect((await call('PUT', '/v1/admin/img/A1', JPEG)).status).toBe(401)
    expect((await call('PUT', '/v1/admin/img/A1', JPEG, asViewer)).status).toBe(403)
    expect((await call('PUT', '/v1/admin/img/A1', SVG, asEditor)).status).toBe(415)
    const big = new Uint8Array(MAX_IMAGE_BYTES + 10); big.set(JPEG)
    expect((await call('PUT', '/v1/admin/img/A1', big, asEditor)).status).toBe(413)
    expect((await call('PUT', '/v1/admin/img/' + 'x'.repeat(30), JPEG, asEditor)).status).toBe(400)
    expect((await call('GET', '/v1/img/none')).status).toBe(404)
  })
  it('delete needs editor and is written to the audit log', async () => {
    await call('PUT', '/v1/admin/img/A1', JPEG, asEditor)
    expect((await call('DELETE', '/v1/admin/img/A1', undefined, asViewer)).status).toBe(403)
    expect((await call('DELETE', '/v1/admin/img/A1', undefined, asEditor)).status).toBe(200)
    expect((await call('GET', '/v1/img/A1')).status).toBe(404)
    const log = (await api.listAudit(10)).map(e => e.action)
    expect(log).toContain('image.upload'); expect(log).toContain('image.delete')
  })
  it('uses the R2-style store when one is passed', async () => {
    const mem = new Map<string, { mime: string; bytes: Uint8Array }>()
    const store: BlobStore = { put: async (id, mime, bytes) => { mem.set(id, { mime, bytes }); return 'ok' }, get: async id => mem.get(id) ?? null, del: async id => mem.delete(id) }
    await call('PUT', '/v1/admin/img/R1', WEBP, asEditor, store)
    expect(mem.get('R1')?.mime).toBe('image/webp')
    expect((await call('GET', '/v1/img/R1', undefined, {}, store)).status).toBe(200)
    expect(await api.getImage('R1')).toBeNull()      // nothing went to D1
  })
})

describe('image helpers', () => {
  it('fitSize shrinks the long side, keeps ratio, never enlarges', () => {
    expect(fitSize(4000, 3000, 1000)).toEqual({ w: 1000, h: 750 })
    expect(fitSize(3000, 4000, 1000)).toEqual({ w: 750, h: 1000 })
    expect(fitSize(800, 600, 1000)).toEqual({ w: 800, h: 600 })
  })
  it('normalizeImageUrl converts share links and rejects what cannot work', () => {
    expect(normalizeImageUrl('').url).toBe('')
    expect(normalizeImageUrl('places/HK001.jpg').url).toBe('places/HK001.jpg')
    expect(normalizeImageUrl('http://example.com/a.jpg').url).toBe('https://example.com/a.jpg')
    expect(normalizeImageUrl('https://drive.google.com/file/d/ABC_123-x/view?usp=sharing').url).toBe('https://lh3.googleusercontent.com/d/ABC_123-x')
    expect(normalizeImageUrl('https://drive.google.com/open?id=ZZ9').url).toBe('https://lh3.googleusercontent.com/d/ZZ9')
    expect(normalizeImageUrl('https://imgur.com/AbC123x').url).toBe('https://i.imgur.com/AbC123x.jpg')
    expect(normalizeImageUrl('https://imgur.com/a/album1').error).toBeTruthy()
    expect(normalizeImageUrl('https://www.dropbox.com/s/xyz/a.jpg?dl=0').url).toBe('https://dl.dropboxusercontent.com/s/xyz/a.jpg?raw=1')
    expect(normalizeImageUrl('https://commons.wikimedia.org/wiki/File:Ho_Hoan_Kiem.jpg').url).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/Ho_Hoan_Kiem.jpg?width=1000')
    expect(normalizeImageUrl('https://www.facebook.com/photo?fbid=1').error).toBeTruthy()
    expect(normalizeImageUrl('ftp://x/y.jpg').error).toBeTruthy()
    expect(normalizeImageUrl('not a url').error).toBeTruthy()
  })
})
