import { useEffect, useState } from 'react'
import { useLang } from '../i18n'
import { C } from '../styles/tokens'
import { aiEnabled, aiSearchPlaces, type AiPlace } from '../utils/backend'

const L10N = {
  VI: {
    title: '✨ Hỏi AI tìm nơi khác', hint: 'Nơi bạn muốn không có trong danh sách của web? Mô tả bằng lời, AI sẽ gợi ý và app kiểm tra nơi đó có thật trên bản đồ.',
    ph: 'Ví dụ: quán cà phê yên tĩnh gần Hồ Tây để làm việc', go: 'Tìm', busy: 'Đang tìm và kiểm tra…',
    none: 'AI chưa tìm được nơi nào kiểm chứng được. Thử mô tả cụ thể hơn (khu vực, loại hình).',
    limit: 'Bạn đã tìm nhiều lần trong giờ qua. Hãy thử lại sau.', error: 'Không tìm được lúc này. Thử lại sau nhé.',
    note: 'Gợi ý của AI — chưa nằm trong dữ liệu của web nên chưa có giờ mở cửa, giá, ảnh. Hãy kiểm tra lại trước khi đi.', noteG: 'Vị trí lấy từ Google Maps.', noteO: 'Vị trí lấy từ OpenStreetMap.',
    gmap: 'Mở Google Maps ↗', osm: 'OpenStreetMap ↗', found: (n: number, a: number) => `Kiểm chứng được ${n}/${a} gợi ý`,
  },
  EN: {
    title: '✨ Ask AI for other places', hint: 'Not in the site\'s list? Describe it in words; AI suggests and the app checks the place really exists on a map.',
    ph: 'e.g. a quiet café near West Lake to work from', go: 'Search', busy: 'Searching and verifying…',
    none: 'AI could not find any place that could be verified. Try being more specific (area, type).',
    limit: 'You searched a lot in the last hour. Please try again later.', error: 'Could not search right now. Try again later.',
    note: 'AI suggestion — not in the site\'s data, so no opening hours, price or photos. Double-check before you go.', noteG: 'Location from Google Maps.', noteO: 'Location from OpenStreetMap.',
    gmap: 'Open in Google Maps ↗', osm: 'OpenStreetMap ↗', found: (n: number, a: number) => `Verified ${n} of ${a} suggestions`,
  },
}

export default function AiSearch() {
  const { lang } = useLang()
  const x = L10N[lang as 'VI' | 'EN'] || L10N.VI
  const [on, setOn] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [res, setRes] = useState<{ places: AiPlace[]; asked: number } | null>(null)
  useEffect(() => { aiEnabled().then(setOn) }, [])
  if (!on) return null

  const go = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || q.trim().length < 3) return
    setBusy(true); setMsg(''); setRes(null)
    const r = await aiSearchPlaces(q.trim())
    setBusy(false)
    if (!r.ok) { setMsg(r.reason === 'limit' ? x.limit : x.error + (r.detail ? ` (${r.detail})` : '')); return }
    if (!r.places.length) { setMsg(x.none); return }
    setRes({ places: r.places, asked: r.asked })
  }
  const link: React.CSSProperties = { fontSize: '0.74rem', color: C.rust, textDecoration: 'none' }

  return (
    <section aria-label={x.title} style={{ margin: '0 0 1.4rem', padding: '1rem 1.1rem', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 }}>
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.2rem', color: C.ink }}>{x.title}</h3>
      <p style={{ fontSize: '0.74rem', color: C.muted, margin: '0 0 0.7rem', lineHeight: 1.6 }}>{x.hint}</p>
      <form onSubmit={go} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input value={q} onChange={e => setQ(e.target.value)} maxLength={200} placeholder={x.ph} aria-label={x.title}
          style={{ flex: '1 1 240px', padding: '0.6rem 0.8rem', fontSize: '0.88rem', border: `1px solid ${C.border}`, borderRadius: 999, background: 'white', fontFamily: "'Be Vietnam Pro',sans-serif" }}/>
        <button type="submit" disabled={busy || q.trim().length < 3} style={{ padding: '0.6rem 1.2rem', borderRadius: 999, border: 'none', background: C.ink, color: C.cream, cursor: busy ? 'wait' : 'pointer', opacity: busy || q.trim().length < 3 ? 0.6 : 1, fontFamily: "'Be Vietnam Pro',sans-serif" }}>{busy ? x.busy : x.go}</button>
      </form>
      <div role="status" aria-live="polite">
        {msg && <p style={{ fontSize: '0.8rem', color: '#9A5B00', margin: '0.7rem 0 0' }}>{msg}</p>}
        {res && <>
          <p style={{ fontSize: '0.72rem', color: C.muted, margin: '0.8rem 0 0.4rem' }}>{x.found(res.places.length, res.asked)} · {x.note} {res.places.some(p => p.source === 'google') ? x.noteG : x.noteO}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 10 }}>
            {res.places.map(p => (
              <article key={p.lat + ',' + p.lng} style={{ padding: '0.8rem 0.9rem', border: `1px solid ${C.border}`, borderRadius: 12, background: 'white' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: C.ink }}>{p.name}</div>
                <div style={{ fontSize: '0.72rem', color: C.muted, margin: '0.1rem 0 0.4rem' }}>{[p.category, p.area].filter(Boolean).join(' · ')}</div>
                {p.why && <p style={{ fontSize: '0.8rem', color: C.ink, margin: '0 0 0.4rem', lineHeight: 1.55 }}>{p.why}</p>}
                {p.address && <p style={{ fontSize: '0.7rem', color: C.muted, margin: '0 0 0.5rem', lineHeight: 1.5 }}>📍 {p.address}</p>}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <a style={link} target="_blank" rel="noopener noreferrer" href={p.maps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ', Hà Nội')}`}>{x.gmap}</a>
                  {p.osm && <a style={link} target="_blank" rel="noopener noreferrer" href={p.osm}>{x.osm}</a>}
                </div>
              </article>
            ))}
          </div>
        </>}
      </div>
    </section>
  )
}
