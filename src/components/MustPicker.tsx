import { useMemo, useState } from 'react'
import { C } from '../styles/tokens'
import { getPlaces } from '../data/placeStore'
import { MAX_MUST } from '../utils/recommend'
import type { PlaceType } from '../types'

const ICON: Record<PlaceType, string> = { attraction: '🏛', food: '🍜', cafe: '☕', museum: '🏺', nature: '🌿', market: '🛍', lodging: '🏨' }
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()

export interface MustText {
  mustTitle: string; mustHint: string; mustSearch: string; mustNone: string
  mustRemove: (n: string) => string; mustMax: (n: number) => string; mustCount: (n: number, max: number) => string
}

/** "Already know where you want to go?" — pick up to 3 places of this site that the plan must include. */
export default function MustPicker({ value, onChange, tx }: { value: string[]; onChange: (ids: string[]) => void; tx: MustText }) {
  const all = useMemo(() => getPlaces().filter(p => p.type !== 'lodging'), [])
  const [q, setQ] = useState('')
  const full = value.length >= MAX_MUST
  const picked = value.map(id => all.find(p => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p)
  const f = fold(q.trim())
  const hits = useMemo(() => (f ? all.filter(p => !value.includes(p.id) && (fold(p.name).includes(f) || fold(p.area).includes(f))).slice(0, 6) : []), [all, f, value])
  return (
    <section aria-label={tx.mustTitle} style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>📌 {tx.mustTitle}</h3>
        <span style={{ fontSize: '0.7rem', color: C.muted }}>{tx.mustCount(value.length, MAX_MUST)}</span>
      </div>
      <p style={{ fontSize: '0.76rem', color: C.muted, margin: '0.2rem 0 0.6rem', lineHeight: 1.5 }}>{tx.mustHint}</p>
      {picked.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.6rem', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {picked.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => onChange(value.filter(x => x !== p.id))} aria-label={tx.mustRemove(p.name)}
                style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: C.rustLight, color: C.rust, border: `1px solid ${C.rust}`, padding: '0.3rem 0.65rem', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span aria-hidden="true">{ICON[p.type]}</span>{p.name}<span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {full
        ? <div role="status" style={{ fontSize: '0.74rem', color: C.muted }}>{tx.mustMax(MAX_MUST)}</div>
        : <>
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={tx.mustSearch} aria-label={tx.mustSearch}
              style={{ width: '100%', padding: '0.65rem 0.8rem', border: `1px solid ${C.border}`, background: '#fff', fontSize: '0.85rem', fontFamily: 'inherit' }}/>
            {f && (
              <ul role="listbox" aria-label={tx.mustTitle} style={{ listStyle: 'none', padding: 0, margin: '0.35rem 0 0', border: hits.length ? `1px solid ${C.border}` : 'none', background: '#fff' }}>
                {hits.map(p => (
                  <li key={p.id} role="option" aria-selected={false}>
                    <button type="button" onClick={() => { onChange([...value, p.id]); setQ('') }}
                      style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, padding: '0.55rem 0.7rem', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
                      <span aria-hidden="true">{ICON[p.type]}</span>
                      <span style={{ flex: 1 }}>{p.name}<span style={{ color: C.muted, fontSize: '0.72rem' }}> · {p.area}</span></span>
                      <span aria-hidden="true" style={{ color: C.rust }}>＋</span>
                    </button>
                  </li>
                ))}
                {hits.length === 0 && <li style={{ fontSize: '0.78rem', color: C.muted, padding: '0.5rem 0.2rem' }}>{tx.mustNone}</li>}
              </ul>
            )}
          </>}
    </section>
  )
}
