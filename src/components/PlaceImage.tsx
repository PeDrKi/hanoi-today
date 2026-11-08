import { useState } from 'react'
import type { PlaceType } from '../types'

const LOOK: Record<PlaceType, { a: string; b: string; icon: string }> = {
  food:       { a: '#f6d2a8', b: '#e8985e', icon: '🍜' },
  cafe:       { a: '#ead8c3', b: '#b98a63', icon: '☕' },
  museum:     { a: '#dcd7ea', b: '#9a8fc0', icon: '🏛' },
  nature:     { a: '#d3e6c8', b: '#7fa970', icon: '🌿' },
  market:     { a: '#f6d6c6', b: '#d98468', icon: '🛍' },
  attraction: { a: '#f4e2b9', b: '#cf9a4a', icon: '⛩' },
  lodging:    { a: '#d6e4ee', b: '#6f9bb8', icon: '🏨' },
}
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export interface PlaceImageProps {
  id: string; name: string; type: PlaceType; area?: string
  image?: string; imageCredit?: string
  height?: number; radius?: number; credit?: boolean; coverOnly?: boolean
}

/** Photo when we have one (and it loads); otherwise a drawn cover in the colour of the place type. */
export default function PlaceImage({ id, name, type, area, image, imageCredit, height = 120, radius = 12, credit = true }: PlaceImageProps) {
  const [failed, setFailed] = useState(false)
  const look = LOOK[type] || LOOK.attraction
  const h = hash(id)
  const showPhoto = !!image && !failed
  return (
    <div style={{ position: 'relative', height, borderRadius: radius, overflow: 'hidden', background: `linear-gradient(135deg,${look.a},${look.b})`, flexShrink: 0 }}>
      {showPhoto ? (
        <img src={image} alt={name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
      ) : (
        <>
          <svg aria-hidden="true" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <circle cx={30 + (h % 140)} cy={20 + (h % 30)} r={38 + (h % 20)} fill="#fff" opacity=".22"/>
            <circle cx={150 - (h % 90)} cy={85} r={46} fill="#fff" opacity=".16"/>
            <path d={`M0 ${78 - (h % 10)} Q 50 ${60 + (h % 14)} 100 ${74} T 200 ${70 - (h % 8)} V100 H0 Z`} fill="#000" opacity=".08"/>
          </svg>
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(28, height * 0.42), filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.15))' }}>{look.icon}</div>
          {area && height >= 80 && <div style={{ position: 'absolute', left: 10, bottom: 8, fontSize: '0.66rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(26,25,22,.62)' }}>{area}</div>}
        </>
      )}
      {showPhoto && credit && imageCredit && height >= 80 && (
        <div style={{ position: 'absolute', right: 6, bottom: 5, fontSize: '0.6rem', color: '#fff', background: 'rgba(0,0,0,.45)', padding: '1px 7px', borderRadius: 999 }}>📷 {imageCredit}</div>
      )}
    </div>
  )
}
