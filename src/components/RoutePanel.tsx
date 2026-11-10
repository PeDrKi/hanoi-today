import { useEffect, useState, Suspense, lazy } from 'react'
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
    steps: 'Xem từng bước', hide: 'Ẩn các bước',
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
    steps: 'Show steps', hide: 'Hide steps',
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

  const plan = st.s === 'ok' ? st.plan : null
  const chip = (on: boolean): React.CSSProperties => ({ fontSize: '0.8rem', padding: '0.45rem 0.9rem', cursor: 'pointer', fontFamily: "'Be Vietnam Pro',sans-serif", borderRadius: 999, background: on ? C.ink : 'none', color: on ? C.cream : C.ink, border: `1px solid ${on ? C.ink : C.border}` })
  const link: React.CSSProperties = { fontSize: '0.72rem', color: C.rust, textDecoration: 'none' }
  const note = mode === 'bus' ? x.busNote : mode === 'walk' ? x.walkNote : x.roadNote

  return (
    <div>
      <div role="group" aria-label="Phương tiện" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {(Object.keys(x.modes) as TravelMode[]).map(m => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} style={chip(mode === m)}>{x.modes[m]}</button>
        ))}
      </div>
      <Suspense fallback={<div className="skeleton" style={{ height: 380 }}/>}><LeafletMap stops={stops} route={plan?.coords}/></Suspense>
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
                  <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', background: MARKER_COLORS[(i + 1) % MARKER_COLORS.length], color: '#fff', fontSize: '0.6rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 2}</span>
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
    </div>
  )
}
