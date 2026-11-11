import { useEffect, useState, Suspense, lazy } from 'react'
import { createPortal } from 'react-dom'
import type { Stop } from '../types'
import { useLang } from '../i18n'
import { C, MARKER_COLORS } from '../styles/tokens'
import { fetchRoute, legUrl, type TravelMode, type RoutePlan } from '../utils/routing'

const LeafletMap = lazy(() => import('./LeafletMap'))

const L10N = {
  VI: {
    modes: { motorbike: '🛵 Xe máy', car: '🚗 Ô tô', bus: '🚌 Xe buýt', walk: '🚶 Đi bộ' } as Record<TravelMode, string>,
    loading: 'Đang tìm đường đi…',
    failed: 'Không tải được đường đi (mạng chậm hoặc dịch vụ bận). Bản đồ đang nối các điểm theo đường chim bay; bạn vẫn có thể mở chỉ đường trên Google Maps.',
    total: (km: string, min: number) => `Tổng: ${km} km · khoảng ${min} phút di chuyển`,
    roadNote: 'Xe máy và ô tô đi cùng mạng đường nên lộ trình giống nhau. Thời gian là ước tính khi đường thông, chưa tính kẹt xe.',
    walkNote: 'Thời gian đi bộ tính theo tốc độ đi bộ trung bình.',
    busNote: 'Chưa có dữ liệu giờ xe buýt miễn phí cho Hà Nội, nên app không tự vẽ tuyến buýt để tránh sai. Bấm từng chặng để mở chỉ đường buýt (số tuyến, giờ, điểm lên xuống) trên Google Maps.',
    leg: (a: number, b: number) => `Điểm ${a} → ${b}`,
    steps: 'Xem từng bước', hide: 'Ẩn các bước', full: '⛶ Toàn màn hình', exit: '✕ Thu nhỏ', sheetShow: 'Chi tiết chặng ▴', sheetHide: 'Ẩn chi tiết ▾',
    open: 'Mở trên Google Maps', openBus: 'Chỉ đường buýt ↗', openAll: 'Mở cả lộ trình trên Google Maps ↗',
    m: (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${n} m`),
  },
  EN: {
    modes: { motorbike: '🛵 Motorbike', car: '🚗 Car', bus: '🚌 Bus', walk: '🚶 Walk' } as Record<TravelMode, string>,
    loading: 'Finding the route…',
    failed: 'Could not load the route (slow network or busy service). The map joins the stops with straight lines; you can still open directions in Google Maps.',
    total: (km: string, min: number) => `Total: ${km} km · about ${min} min of travel`,
    roadNote: 'Motorbikes and cars share the same streets, so the route is the same. Times assume clear roads, not traffic.',
    walkNote: 'Walking time uses an average walking speed.',
    busNote: 'There is no free Hanoi bus timetable data, so the app does not draw bus lines rather than guess. Tap a leg to open bus directions (lines, times, stops) in Google Maps.',
    leg: (a: number, b: number) => `Stop ${a} → ${b}`,
    steps: 'Show steps', hide: 'Hide steps', full: '⛶ Full screen', exit: '✕ Close', sheetShow: 'Leg details ▴', sheetHide: 'Hide details ▾',
    open: 'Open in Google Maps', openBus: 'Bus directions ↗', openAll: 'Open the whole route in Google Maps ↗',
    m: (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} km` : `${n} m`),
  },
}

type St = { s: 'idle' } | { s: 'loading' } | { s: 'ok'; plan: RoutePlan } | { s: 'fail' }

export default function RoutePanel({ stops }: { stops: Stop[] }) {
  const { lang } = useLang()
  const x = L10N[lang as 'VI' | 'EN'] || L10N.VI
  const [mode, setMode] = useState<TravelMode>('motorbike')
  const [st, setSt] = useState<St>({ s: 'idle' })
  const [open, setOpen] = useState<number | null>(null)
  const [full, setFull] = useState(false)
  const [sheet, setSheet] = useState(false)
  const pts = stops.filter(s => s.lat && s.lng)
  const sig = pts.map(p => `${p.lat},${p.lng}`).join(';')

  useEffect(() => {
    setOpen(null)
    if (mode === 'bus' || pts.length < 2) { setSt({ s: 'idle' }); return }
    const ctl = new AbortController()
    setSt({ s: 'loading' })
    fetchRoute(pts, mode, ctl.signal).then(plan => { if (!ctl.signal.aborted) setSt(plan ? { s: 'ok', plan } : { s: 'fail' }) })
    return () => ctl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, mode])

  // full screen map: Esc closes it, the page behind does not scroll
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false) }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [full])

  const plan = st.s === 'ok' ? st.plan : null
  const chip = (on: boolean): React.CSSProperties => ({ fontSize: '0.8rem', padding: '0.45rem 0.9rem', cursor: 'pointer', fontFamily: "'Be Vietnam Pro',sans-serif", borderRadius: 999, background: on ? (full ? C.rust : C.ink) : (full ? 'rgba(255,255,255,0.14)' : 'none'), color: on ? C.cream : (full ? C.cream : C.ink), border: `1px solid ${on ? (full ? C.rust : C.ink) : (full ? 'transparent' : C.border)}` })
  const link: React.CSSProperties = { fontSize: '0.72rem', color: C.rust, textDecoration: 'none' }
  const note = mode === 'bus' ? x.busNote : mode === 'walk' ? x.walkNote : x.roadNote

  const chipsEl = (
      <div role="group" aria-label="Phương tiện" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: full ? 0 : 10 }}>
        {(Object.keys(x.modes) as TravelMode[]).map(m => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} style={chip(mode === m)}>{x.modes[m]}</button>
        ))}
      </div>
  )
  const detailEl = (
      <div style={{ marginTop: '0.9rem', padding: '1rem', background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 }}>
        <div role="status" style={{ fontSize: '0.84rem', fontWeight: 600, color: C.ink, marginBottom: 4 }}>
          {st.s === 'loading' && x.loading}
          {plan && x.total(plan.km.toFixed(1), plan.min)}
          {st.s === 'fail' && <span style={{ fontWeight: 400, color: '#9A5B00' }}>{x.failed}</span>}
        </div>
        <p style={{ fontSize: '0.72rem', color: C.muted, lineHeight: 1.6, margin: '0 0 0.7rem' }}>{note}</p>
        {pts.length > 1 && <div style={{ display: 'flex', flexDirection: 'column' }}>
          {pts.slice(1).map((b, i) => {
            const a = pts[i], leg = plan?.legs[i], isOpen = open === i
            return (
              <div key={i} style={{ borderTop: `1px solid ${C.border}`, padding: '0.6rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', background: MARKER_COLORS[i % MARKER_COLORS.length], color: '#fff', fontSize: '0.6rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                  <span aria-hidden="true" style={{ width: 22, height: 5, borderRadius: 3, background: MARKER_COLORS[i % MARKER_COLORS.length] }}/>
                  <span style={{ fontSize: '0.82rem', fontWeight: 500, color: C.ink }}>{x.leg(i + 1, i + 2)} · {b.name}</span>
                  {leg && mode !== 'bus' && <span style={{ fontSize: '0.74rem', color: C.muted }}>{leg.km.toFixed(1)} km · ~{leg.min} {lang === 'EN' ? 'min' : 'phút'}</span>}
                  <a href={legUrl(a, b, mode)} target="_blank" rel="noopener noreferrer" style={{ ...link, marginLeft: 'auto' }}>{mode === 'bus' ? x.openBus : x.open}</a>
                </div>
                {leg && leg.steps.length > 0 && mode !== 'bus' && (
                  <div style={{ marginTop: 4 }}>
                    <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.72rem', color: C.muted, textDecoration: 'underline', fontFamily: "'Be Vietnam Pro',sans-serif" }}>{isOpen ? x.hide : x.steps}</button>
                    {isOpen && <ol style={{ margin: '0.4rem 0 0 1.2rem', padding: 0, fontSize: '0.78rem', color: C.ink, lineHeight: 1.7 }}>
                      {leg.steps.map((s, k) => <li key={k}>{s.text}{s.m > 0 && <span style={{ color: C.muted }}> · {x.m(s.m)}</span>}</li>)}
                    </ol>}
                  </div>
                )}
              </div>
            )
          })}
        </div>}
      </div>
  )
  const fullBtn = (
    <button type="button" onClick={() => setFull(f => !f)} aria-label={full ? x.exit : x.full}
      style={{ position: 'absolute', top: 10, right: 10, zIndex: 600, padding: '0.45rem 0.9rem', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Be Vietnam Pro',sans-serif", background: full ? C.rust : 'rgba(255,255,255,0.94)', color: full ? '#fff' : '#1A1916', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>
      {full ? x.exit : x.full}
    </button>
  )

  // portalled to <body>: an animated ancestor would otherwise become the containing block of `position: fixed`
  if (full) return createPortal(
    <div role="dialog" aria-modal="true" aria-label={x.full} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#1A1916', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0.6rem 0.8rem', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: 'rgba(26,25,22,0.96)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>{chipsEl}</div>
        <button type="button" onClick={() => setFull(false)} style={{ padding: '0.45rem 0.95rem', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Be Vietnam Pro',sans-serif", background: C.rust, color: '#fff' }}>{x.exit}</button>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <Suspense fallback={<div className="skeleton" style={{ height: "100%" }}/>}><LeafletMap height="100%" stops={stops} route={plan ? plan.legs.map(l => l.coords).filter(c => c.length > 1).length === plan.legs.length ? plan.legs.map(l => l.coords) : [plan.coords] : null}/></Suspense>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 600, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          <button type="button" onClick={() => setSheet(v => !v)} aria-expanded={sheet} style={{ alignSelf: 'center', margin: '0 0 6px', padding: '0.45rem 1.1rem', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Be Vietnam Pro',sans-serif", background: 'rgba(255,255,255,0.95)', color: '#1A1916', boxShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>
            {plan ? `${plan.km.toFixed(1)} km · ~${plan.min} ${lang === 'EN' ? 'min' : 'phút'} · ` : ''}{sheet ? x.sheetHide : x.sheetShow}
          </button>
          {sheet && <div style={{ maxHeight: '45vh', overflowY: 'auto', padding: '0 0.8rem 0.8rem', background: 'rgba(244,239,230,0.97)', borderTop: `1px solid ${C.border}` }}>{detailEl}</div>}
        </div>
      </div>
    </div>,
    document.body
  )

  return (
    <div>
      {chipsEl}
      <div style={{ position: 'relative' }}>
        <Suspense fallback={<div className="skeleton" style={{ height: 380 }}/>}><LeafletMap stops={stops} route={plan ? plan.legs.map(l => l.coords).filter(c => c.length > 1).length === plan.legs.length ? plan.legs.map(l => l.coords) : [plan.coords] : null}/></Suspense>
        {fullBtn}
      </div>
      {detailEl}
    </div>
  )
}
