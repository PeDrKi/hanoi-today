import { useEffect, useState } from 'react'
import { useLang } from '../i18n'
import { C } from '../styles/tokens'
import { makeExtra, extraId, EXTRA_DURATIONS, type ExtraPlace } from '../utils/extraPlaces'
import { aiEnabled, aiSearchPlaces, type AiPlace } from '../utils/backend'

const L10N = {
  VI: {
    title: '✨ Hỏi AI tìm nơi khác', hint: 'Nơi bạn muốn không có trong danh sách của web? Mô tả bằng lời, AI sẽ gợi ý và app kiểm tra nơi đó có thật trên bản đồ.',
    ph: 'Ví dụ: quán cà phê yên tĩnh gần Hồ Tây để làm việc', go: 'Tìm', busy: 'Đang tìm và kiểm tra…',
    none: 'AI chưa tìm được nơi nào kiểm chứng được. Thử mô tả cụ thể hơn (khu vực, loại hình).',
    limit: 'Bạn đã tìm nhiều lần trong giờ qua. Hãy thử lại sau.', error: 'Không tìm được lúc này. Thử lại sau nhé.',
    note: 'Gợi ý của AI — chưa nằm trong dữ liệu của web nên chưa có giờ mở cửa, giá, ảnh. Hãy kiểm tra lại trước khi đi.', noteG: 'Vị trí lấy từ Google Maps.', noteO: 'Vị trí lấy từ OpenStreetMap.',
    add: '＋ Thêm vào lộ trình', ask: (n: string) => `Thêm "${n}" vào lộ trình của bạn?`, stay: 'Ghé khoảng', min: 'phút', yes: 'Thêm vào', no: 'Không',
    added: 'Đã thêm vào lộ trình', remove: 'Bỏ', full: 'Đã đủ 3 nơi', plan: 'Tạo lộ trình có các nơi này', unknown: 'Chưa rõ giờ mở cửa và giá của nơi này nên app sẽ xếp thử vào lịch của bạn; hãy kiểm tra trước khi đi.',
    gmap: 'Mở Google Maps ↗', osm: 'OpenStreetMap ↗', found: (n: number, a: number) => `Kiểm chứng được ${n}/${a} gợi ý`,
  },
  EN: {
    title: '✨ Ask AI for other places', hint: 'Not in the site\'s list? Describe it in words; AI suggests and the app checks the place really exists on a map.',
    ph: 'e.g. a quiet café near West Lake to work from', go: 'Search', busy: 'Searching and verifying…',
    none: 'AI could not find any place that could be verified. Try being more specific (area, type).',
    limit: 'You searched a lot in the last hour. Please try again later.', error: 'Could not search right now. Try again later.',
    note: 'AI suggestion — not in the site\'s data, so no opening hours, price or photos. Double-check before you go.', noteG: 'Location from Google Maps.', noteO: 'Location from OpenStreetMap.',
    add: '＋ Add to my plan', ask: (n: string) => `Add "${n}" to your plan?`, stay: 'Stay about', min: 'min', yes: 'Add', no: 'No',
    added: 'Added to plan', remove: 'Remove', full: 'Plan is full (3)', plan: 'Plan with these places', unknown: 'Opening hours and price are unknown, so the app will just fit it into your day; check before you go.',
    gmap: 'Open in Google Maps ↗', osm: 'OpenStreetMap ↗', found: (n: number, a: number) => `Verified ${n} of ${a} suggestions`,
  },
}

export default function AiSearch({ extras = [], maxExtras = 3, onAdd, onRemove, onPlan }: { extras?: ExtraPlace[]; maxExtras?: number; onAdd?: (e: ExtraPlace) => void; onRemove?: (id: string) => void; onPlan?: () => void }) {
  const { lang } = useLang()
  const x = L10N[lang as 'VI' | 'EN'] || L10N.VI
  const [on, setOn] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [asking, setAsking] = useState<string | null>(null)
  const [stay, setStay] = useState(60)
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
                {onAdd && (() => {
                  const id = extraId(p.lat, p.lng), inPlan = extras.some(e => e.id === id), full = !inPlan && extras.length >= maxExtras
                  if (inPlan) return <div style={{ margin: '0 0 0.5rem', fontSize: '0.76rem', color: '#3D5C35' }}>✓ {x.added} · <button type="button" onClick={() => onRemove?.(id)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.muted, textDecoration: 'underline', fontSize: '0.74rem', fontFamily: "'Be Vietnam Pro',sans-serif" }}>{x.remove}</button></div>
                  if (asking === id) return (
                    <div role="group" aria-label={x.ask(p.name)} style={{ margin: '0 0 0.6rem', padding: '0.6rem 0.7rem', background: 'rgba(200,70,20,0.06)', border: `1px solid ${C.border}`, borderRadius: 10 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: C.ink, marginBottom: 4 }}>{x.ask(p.name)}</div>
                      <p style={{ fontSize: '0.7rem', color: C.muted, margin: '0 0 0.5rem', lineHeight: 1.55 }}>{x.unknown}</p>
                      <label style={{ fontSize: '0.74rem', color: C.ink, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>{x.stay}
                        <select value={stay} onChange={e => setStay(Number(e.target.value))} style={{ padding: '0.25rem 0.4rem', borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: "'Be Vietnam Pro',sans-serif" }}>
                          {EXTRA_DURATIONS.map(d => <option key={d} value={d}>{d} {x.min}</option>)}
                        </select>
                      </label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => { onAdd(makeExtra(p, stay)); setAsking(null) }} style={{ padding: '0.4rem 0.9rem', borderRadius: 999, border: 'none', background: C.rust, color: 'white', cursor: 'pointer', fontSize: '0.76rem', fontFamily: "'Be Vietnam Pro',sans-serif" }}>{x.yes}</button>
                        <button type="button" onClick={() => setAsking(null)} style={{ padding: '0.4rem 0.9rem', borderRadius: 999, border: `1px solid ${C.border}`, background: 'none', color: C.ink, cursor: 'pointer', fontSize: '0.76rem', fontFamily: "'Be Vietnam Pro',sans-serif" }}>{x.no}</button>
                      </div>
                    </div>
                  )
                  return <button type="button" disabled={full} onClick={() => { setStay(60); setAsking(id) }} style={{ margin: '0 0 0.5rem', padding: '0.4rem 0.9rem', borderRadius: 999, border: `1px solid ${C.rust}`, background: 'none', color: C.rust, cursor: full ? 'not-allowed' : 'pointer', opacity: full ? 0.5 : 1, fontSize: '0.76rem', fontFamily: "'Be Vietnam Pro',sans-serif" }}>{full ? x.full : x.add}</button>
                })()}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <a style={link} target="_blank" rel="noopener noreferrer" href={p.maps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name + ', Hà Nội')}`}>{x.gmap}</a>
                  {p.osm && <a style={link} target="_blank" rel="noopener noreferrer" href={p.osm}>{x.osm}</a>}
                </div>
              </article>
            ))}
          </div>
          {extras.length > 0 && onPlan && <div style={{ marginTop: 12 }}><button type="button" onClick={onPlan} style={{ padding: '0.6rem 1.3rem', borderRadius: 999, border: 'none', background: C.ink, color: C.cream, cursor: 'pointer', fontFamily: "'Be Vietnam Pro',sans-serif" }}>{x.plan} ({extras.length}) →</button></div>}
        </>}
      </div>
    </section>
  )
}
