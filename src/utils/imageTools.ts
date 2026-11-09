// Helpers for place photos: shrink a picture in the browser before uploading, and tidy a pasted link.

/** Scale (w,h) down so the longer side is at most `max`; never scales up. */
export function fitSize(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

export interface ResizeOpts { maxSide: number; maxBytes: number }

const toBlob = (c: HTMLCanvasElement, type: string, q: number) => new Promise<Blob | null>(res => c.toBlob(res, type, q))

/**
 * Decode `file`, scale it to `maxSide`, and re-encode (WebP when the browser can, else JPEG) with falling quality
 * until it is at most `maxBytes`. Throws Error('decode') when the browser cannot read the picture and Error('toolarge') when it cannot be made small enough.
 */
export async function resizeToBlob(file: Blob, { maxSide, maxBytes }: ResizeOpts): Promise<Blob> {
  let bmp: ImageBitmap
  try { bmp = await createImageBitmap(file) } catch { throw new Error('decode') }
  try {
    let side = maxSide
    for (let round = 0; round < 4; round++) {
      const { w, h } = fitSize(bmp.width, bmp.height, side)
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const g = c.getContext('2d'); if (!g) throw new Error('decode')
      g.fillStyle = '#fff'; g.fillRect(0, 0, w, h)        // transparent PNGs become white, not black
      g.drawImage(bmp, 0, 0, w, h)
      for (const q of [0.86, 0.76, 0.66, 0.56, 0.46]) {
        let b = await toBlob(c, 'image/webp', q)
        if (!b || b.type !== 'image/webp') b = await toBlob(c, 'image/jpeg', q)   // older Safari cannot encode WebP
        if (b && b.size <= maxBytes) return b
      }
      side = Math.round(side * 0.8)
    }
    throw new Error('toolarge')
  } finally { bmp.close?.() }
}

export const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('decode')); r.readAsDataURL(b) })

export interface UrlResult { url: string; note?: string; error?: string }

/**
 * Turn whatever was pasted into a link the <img> tag can really load.
 * Share pages (Google Drive, Imgur, Dropbox, Wikimedia Commons) are converted to direct image links; http is upgraded to https;
 * links that can never work as a photo (Facebook, Instagram, Google Photos albums…) are rejected with the reason.
 */
export function normalizeImageUrl(input: string): UrlResult {
  const raw = (input || '').trim()
  if (!raw) return { url: '' }
  if (/^places\/[\w.-]+$/.test(raw)) return { url: raw }
  if (/^data:image\/(jpeg|png|webp);base64,/.test(raw)) return { url: raw }
  let u: URL
  try { u = new URL(/^\/\//.test(raw) ? 'https:' + raw : raw) } catch { return { url: raw, error: 'Đây không phải một đường dẫn hợp lệ.' } }
  if (u.protocol === 'http:') u.protocol = 'https:'
  if (u.protocol !== 'https:') return { url: raw, error: 'Chỉ nhận đường dẫn https:// (hoặc places/<mã>.jpg).' }
  const host = u.hostname.replace(/^www\./, '')

  if (host === 'drive.google.com') {
    const id = /\/file\/d\/([\w-]+)/.exec(u.pathname)?.[1] || u.searchParams.get('id')
    if (!id) return { url: raw, error: 'Link Google Drive này không có mã tệp.' }
    return { url: `https://lh3.googleusercontent.com/d/${id}`, note: 'Đã đổi link Google Drive thành link ảnh trực tiếp. Tệp phải để chế độ "Bất kỳ ai có đường liên kết".' }
  }
  if (host === 'imgur.com') {
    const id = /^\/([A-Za-z0-9]{5,8})$/.exec(u.pathname)?.[1]
    if (!id) return { url: raw, error: 'Link album Imgur không dùng được. Hãy mở ảnh, chọn "Copy image address".' }
    return { url: `https://i.imgur.com/${id}.jpg`, note: 'Đã đổi link Imgur thành link ảnh trực tiếp.' }
  }
  if (host === 'dropbox.com') {
    u.hostname = 'dl.dropboxusercontent.com'; u.searchParams.delete('dl'); u.searchParams.set('raw', '1')
    return { url: u.toString(), note: 'Đã đổi link Dropbox thành link ảnh trực tiếp.' }
  }
  if (host === 'commons.wikimedia.org' && /^\/wiki\/File:/.test(u.pathname)) {
    return { url: `https://commons.wikimedia.org/wiki/Special:FilePath/${u.pathname.replace(/^\/wiki\/File:/, '')}?width=1000`, note: 'Đã đổi link Wikimedia Commons thành link ảnh (rộng 1000px). Nhớ ghi nguồn và giấy phép ở ô "Nguồn / tác giả ảnh".' }
  }
  if (/(^|\.)(facebook|fb|instagram)\.com$/.test(host) || host === 'photos.google.com' || host === 'photos.app.goo.gl' || host === 'pinterest.com') {
    return { url: raw, error: 'Trang này không cho gắn ảnh trực tiếp. Hãy tải ảnh về rồi dùng nút "Tải ảnh từ máy".' }
  }
  return { url: u.toString() }
}
