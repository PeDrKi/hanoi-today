import { useState } from 'react'
import { C } from '../styles/tokens'
import { useRatings, fmtAvg } from '../utils/ratings'
import { useT, useLang } from '../i18n'

/** Average + the visitor's own 1–5 star rating for one place. `readOnly` shows only the average. */
export default function PlaceRating({ placeId, name, compact = false }: { placeId: string; name: string; compact?: boolean }) {
  const { mine, aggs, rate } = useRatings()
  const t = useT(), { lang } = useLang()
  const r = t.rating
  const [hover, setHover] = useState(0)
  const [thanks, setThanks] = useState(false)
  const my = mine[placeId] || 0, a = aggs[placeId], shown = hover || my
  const size = compact ? 28 : 34
  return (
    <div style={{ marginTop: compact ? 8 : 10, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div role="radiogroup" aria-label={r.groupLabel(name)} style={{ display: 'flex' }} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" role="radio" className="star-btn" aria-checked={my === n} aria-label={r.starLabel(n)}
              onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onBlur={() => setHover(0)}
              onClick={() => { rate(placeId, n); setThanks(true) }}
              style={{ width: size, height: size, minWidth: size, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: compact ? '1.15rem' : '1.4rem', lineHeight: 1, color: n <= shown ? '#E8A020' : '#CFC7B4', transition: 'color .12s, transform .15s var(--ease-out)', transform: n === my && !hover ? 'scale(1.12)' : 'none' }}>
              ★
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.74rem', color: C.muted }}>
          {a && a.n > 0 ? <><b style={{ color: C.ink }}>★ {fmtAvg(a.avg, lang === 'EN' ? 'en' : 'vi')}</b> · {r.count(a.n)}</> : r.none}
        </div>
      </div>
      <div role="status" style={{ fontSize: '0.7rem', color: my ? '#2E7D52' : C.muted, minHeight: '1em', marginTop: 2 }}>
        {my ? (thanks ? r.thanks(my) : r.yours(my)) : r.prompt}
      </div>
    </div>
  )
}
