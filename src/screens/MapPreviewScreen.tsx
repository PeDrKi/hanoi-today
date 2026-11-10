import { MAX_MUST } from '../utils/recommend'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import L from '../utils/leafletGlobal'
import 'leaflet.markercluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { getPlaces }             from '../data/placeStore'
import { escapeHtml }            from '../utils/html'
import { SEASON_LABELS, getCurrentSeason, mergeSeasonsIntoPlaces, seasonLevel } from '../data/seasons'
import { C, MARKER_COLORS }      from '../styles/tokens'
import { SkeletonMap }           from '../components/Skeleton'
import LangToggle                from '../components/LangToggle'
import { useT }                  from '../i18n'
import { topPicksByType, type PickReason } from '../utils/topPicks'
import PlaceRating from '../components/PlaceRating'
import { useRatings, fmtAvg } from '../utils/ratings'
import type { Place, PlaceType } from '../types'

const TYPE_ICONS: Record<PlaceType, string>  = { attraction:'🏛', food:'🍜', cafe:'☕', museum:'🏺', nature:'🌿', market:'🛍', lodging:'🏨' }
const TYPE_COLORS: Record<PlaceType, string> = { attraction:'#B85C2A', food:'#E8A020', cafe:'#6B4E35', museum:'#5A4A8A', nature:'#3D5C35', market:'#2A7BA8', lodging:'#4A7A8C' }

export default function MapPreviewScreen({ onStart, onHome, mustIds = [], onToggleMust }: { onStart: () => void; onHome?: () => void; mustIds?: string[]; onToggleMust?: (id: string) => void }) {
  const t  = useT()
  const m  = t.map
  const sl = t.seasons

  const PLACES_S = useMemo(() => mergeSeasonsIntoPlaces(getPlaces()), [])
  const currentMonth  = new Date().getMonth() + 1
  const currentSeason = getCurrentSeason(currentMonth)

  const [selMonth,   setSelMonth]   = useState(currentMonth)
  const [activeType, setActiveType] = useState<PlaceType | 'all'>('all')
  const [selected,   setSelected]   = useState<Place | null>(null)
  const [showPanel,  setShowPanel]  = useState(false)
  const [mapReady,   setMapReady]   = useState(false)
  const [stats,      setStats]      = useState({ total:0, inSeason:0 })
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState<Place[]>([])
  const [showDrop,   setShowDrop]   = useState(false)
  const [picksOpen,  setPicksOpen]  = useState(() => typeof window === 'undefined' || window.innerWidth >= 900)

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const markersRef   = useRef<Record<string, L.Marker>>({})
  const clusterRef   = useRef<L.MarkerClusterGroup | null>(null)
  const [tilesFailed, setTilesFailed] = useState(false)
  const searchRef    = useRef<HTMLDivElement>(null)

  // "at its best" = the season text singles this month out; "fine" = month is in bestMonths; otherwise off-season
  const inSeasonIds = useMemo(() => new Set(PLACES_S.filter(p => seasonLevel(p.id, selMonth) === 'peak').map(p => p.id)), [PLACES_S, selMonth])
  const okIds       = useMemo(() => new Set(PLACES_S.filter(p => (p.bestMonths || []).includes(selMonth)).map(p => p.id)), [PLACES_S, selMonth])

  // "Đáng đến nhất": best few of each category for the chosen month (all categories → 3 each; one category → 5)
  const { aggs } = useRatings()
  const picks = useMemo(
    () => topPicksByType(PLACES_S, p => seasonLevel(p.id, selMonth), activeType === 'all' ? 3 : 5, activeType === 'all' ? undefined : [activeType], aggs),
    [PLACES_S, selMonth, activeType, aggs])
  const anyRated = picks.some(g => g.picks.some(k => k.reasons.includes('rated')))
  const pickIds = useMemo(() => new Set(picks.flatMap(g => g.picks.map(k => k.place.id))), [picks])
  const whyText: Record<PickReason, string> = { editor: m.whyEditor, peak: m.whyPeak, season: m.whySeason, wide: m.whyWide, rated: m.whyRated }

  // Search logic
  const handleSearch = (q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); setShowDrop(false); return }
    const lo = q.toLowerCase()
    const res = PLACES_S.filter(p =>
      p.name.toLowerCase().includes(lo) ||
      p.area.toLowerCase().includes(lo) ||
      p.type.toLowerCase().includes(lo) ||
      p.desc.toLowerCase().includes(lo)
    ).slice(0, 8)
    setResults(res); setShowDrop(res.length > 0)
  }

  const handleSelectSearch = (place: Place) => {
    setQuery(place.name); setShowDrop(false)
    setSelected(place); setShowPanel(true)
    if (mapRef.current) {
      mapRef.current.flyTo([place.lat, place.lng], 16, { animate:true, duration:0.8 })
      const mk = markersRef.current[place.id]
      if (mk) setTimeout(() => mk.openPopup(), 900)
    }
  }

  useEffect(() => {
    const h = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Build map
  const buildMap = useCallback(() => {
    if (!containerRef.current) return

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, { center:[21.028,105.854], zoom:13 })
      let loaded = 0, failed = 0
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:'© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom:19,
      })
      tiles.on('tileload', () => { loaded++ })
      tiles.on('tileerror', () => { failed++; if (failed >= 3 && loaded === 0) setTilesFailed(true) })
      tiles.addTo(mapRef.current)
      clusterRef.current = L.markerClusterGroup({ maxClusterRadius:42, showCoverageOnHover:false, spiderfyOnMaxZoom:true }).addTo(mapRef.current)
      setMapReady(true)
    }

    const cluster = clusterRef.current!
    cluster.clearLayers()
    markersRef.current = {}

    const visible = PLACES_S.filter(p => activeType === 'all' || p.type === activeType)
    visible.forEach(place => {
      const ins = inSeasonIds.has(place.id)
      const ok  = okIds.has(place.id)
      const col = TYPE_COLORS[place.type] || C.rust
      const icon = L.divIcon({
        className:'',
        html:`<div style="position:relative;opacity:${ins?1:ok?.75:.35};transform:scale(${ins?1:ok?.9:.75});transform-origin:bottom center">
          ${pickIds.has(place.id)?`<div style="position:absolute;top:-10px;left:-9px;z-index:2;font-size:13px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,.45))">⭐</div>`:''}
          ${ins?`<div style="position:absolute;top:-8px;right:-8px;background:#2E7D52;color:white;font-size:8px;padding:1px 4px;font-weight:700;white-space:nowrap">✓</div>`:''}
          <div class="custom-pin" style="background:${col}"><span>${TYPE_ICONS[place.type]||'📍'}</span></div>
        </div>`,
        iconSize:[28,28], iconAnchor:[14,28], popupAnchor:[0,-30],
      })
      const mk = L.marker([place.lat, place.lng], { icon })
      cluster.addLayer(mk)
      mk.on('click', () => { setSelected(place); setShowPanel(true) })
      mk.bindTooltip(`<div style="font-family:'Be Vietnam Pro',sans-serif;font-size:12px"><strong>${escapeHtml(place.name)}</strong><br/><span style="color:#7A746E">${escapeHtml(place.area)} · ${escapeHtml(place.type)}</span>${ins?'<br/><span style="color:#2E7D52;font-weight:600">✓ In season</span>':''}</div>`, { permanent:false, direction:'top' })
      markersRef.current[place.id] = mk
    })

    const total   = visible.length
    const inSeas  = visible.filter(p => inSeasonIds.has(p.id)).length
    setStats({ total, inSeason:inSeas })
  }, [PLACES_S, activeType, inSeasonIds, okIds, pickIds])

  useEffect(() => { buildMap() }, [buildMap])
  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; clusterRef.current = null }, [])

  const season = SEASON_LABELS[currentSeason]
  const types  = [
    { id:'all', label:m.typeAll, icon:'🗺' },
    { id:'attraction', label:m.typeAttraction, icon:'🏛' },
    { id:'food', label:m.typeFood, icon:'🍜' },
    { id:'cafe', label:m.typeCafe, icon:'☕' },
    { id:'museum', label:m.typeMuseum, icon:'🏺' },
    { id:'nature', label:m.typeNature, icon:'🌿' },
    { id:'market', label:m.typeMarket, icon:'🛍' },
  ]

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', fontFamily:"'Be Vietnam Pro',sans-serif", position:'relative' }}>

      {/* TOP BAR */}
      <div className="map-topbar" style={{ background:C.ink, color:C.cream, padding:'0.85rem 1.25rem', display:'flex', alignItems:'center', gap:'1rem', zIndex:1000, flexShrink:0 }}>
        <button onClick={onHome} title="Trang chủ" aria-label="Trang chủ" style={{ fontFamily:"'Playfair Display',serif", fontSize:'1rem', flexShrink:0, background:'none', border:'none', color:'inherit', cursor:onHome?'pointer':'default', padding:0, textAlign:'left' }}>{onHome ? '← ' : ''}Hà Nội Hôm Nay</button>

        {/* Search */}
        <div className="search-wrap" ref={searchRef} style={{ position:'relative', flex:1, maxWidth:320 }}>
          <div style={{ position:'relative' }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:'0.85rem', pointerEvents:'none', opacity:.5 }}>🔍</span>
            <input value={query} onChange={e => handleSearch(e.target.value)}
              onFocus={() => query && setShowDrop(results.length > 0)}
              placeholder={m.placeholder}
              style={{ width:'100%', padding:'0.42rem 0.75rem 0.42rem 2rem', background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.2)', color:C.cream, fontSize:'0.82rem', fontFamily:"'Be Vietnam Pro',sans-serif", outline:'none' }}/>
            {query && (
              <button onClick={() => { setQuery(''); setResults([]); setShowDrop(false) }}
                style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.5)', fontSize:'0.85rem' }}>✕</button>
            )}
          </div>
          {showDrop && (
            <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:C.cream, border:`1px solid ${C.border}`, boxShadow:'0 8px 24px rgba(0,0,0,.15)', zIndex:3000, maxHeight:300, overflowY:'auto' }}>
              {results.map((place, i) => (
                <div key={place.id} onClick={() => handleSelectSearch(place)}
                  style={{ padding:'0.7rem 1rem', cursor:'pointer', borderBottom:`1px solid ${C.border}`, background:i%2===0?'white':C.cream, display:'flex', alignItems:'center', gap:'0.75rem', transition:'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background=C.rustLight}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?'white':C.cream}>
                  <div style={{ width:32, height:32, flexShrink:0, background:`${TYPE_COLORS[place.type]||C.rust}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', border:`1px solid ${C.border}` }}>
                    {TYPE_ICONS[place.type]||'📍'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, fontSize:'0.85rem', color:C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{place.name}</div>
                    <div style={{ fontSize:'0.7rem', color:C.muted, marginTop:1 }}>
                      {place.area} · {place.type}
                      {place.cost === 0 && <span style={{ color:'#2E7D52', marginLeft:6 }}>{m.free}</span>}
                    </div>
                  </div>
                  {inSeasonIds.has(place.id) && (
                    <span style={{ fontSize:'0.6rem', background:'#2E7D52', color:'white', padding:'0.15rem 0.45rem', fontWeight:600, flexShrink:0 }}>{m.inSeasonBadge}</span>
                  )}
                </div>
              ))}
              <div style={{ padding:'0.5rem 1rem', fontSize:'0.68rem', color:C.muted, background:C.cream, textAlign:'center' }}>
                {results.length} {m.searchHint}
              </div>
            </div>
          )}
        </div>

        <div style={{ width:1, height:20, background:'rgba(255,255,255,0.2)' }}/>

        {/* Month selector */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:'0.72rem', color:'rgba(255,255,255,0.5)', letterSpacing:'0.08em', textTransform:'uppercase' }}>{m.monthLbl}</span>
          <select value={selMonth} onChange={e => setSelMonth(+e.target.value)}
            style={{ background:'rgba(255,255,255,0.1)', color:C.cream, border:'1px solid rgba(255,255,255,0.2)', padding:'0.3rem 0.6rem', fontSize:'0.82rem', cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif" }}>
            {Array.from({length:12},(_,i)=>i+1).map(mn => (
              <option key={mn} value={mn} style={{ background:C.ink }}>
                {t.months[mn]}{mn === currentMonth ? ` ${m.current}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Season badge */}
        <div className="season-badge" style={{ background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', padding:'0.3rem 0.75rem', fontSize:'0.78rem', display:'flex', alignItems:'center', gap:6 }}>
          <span>{season.icon}</span>
          <span>{sl[currentSeason]}</span>
          <span style={{ color:'rgba(255,255,255,0.45)', fontSize:'0.7rem' }}>— {season.desc}</span>
        </div>

        <div style={{ marginLeft:'auto', fontSize:'0.75rem', color:'rgba(255,255,255,0.5)', textAlign:'right', flexShrink:0 }}>
          <span style={{ color:'#4CAF50', fontWeight:600 }}>{stats.inSeason}</span> {m.inSeasonCount}
          <span style={{ margin:'0 6px' }}>·</span>
          {stats.total} {m.showing}
        </div>

        <LangToggle dark/>

        <button onClick={onStart}
          style={{ background:C.rust, color:'white', border:'none', padding:'0.6rem 1.25rem', fontSize:'0.85rem', fontFamily:"'Be Vietnam Pro',sans-serif", fontWeight:500, cursor:'pointer', flexShrink:0 }}
          onMouseEnter={e => e.currentTarget.style.opacity='0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity='1'}>
          {m.ctaBtn}
        </button>
      </div>

      {/* TYPE FILTER */}
      <div className="type-filter" style={{ background:C.cream, borderBottom:`1px solid ${C.border}`, padding:'0.5rem 1.25rem', display:'flex', gap:6, alignItems:'center', overflowX:'auto', flexShrink:0, zIndex:999 }}>
        <span style={{ fontSize:'0.68rem', color:C.muted, letterSpacing:'0.08em', textTransform:'uppercase', marginRight:4, whiteSpace:'nowrap' }}>{m.filterLbl}</span>
        {types.map(tp => (
          <button key={tp.id} onClick={() => setActiveType(tp.id as PlaceType | 'all')}
            style={{ background:activeType===tp.id?C.ink:'white', color:activeType===tp.id?C.cream:C.muted, border:`1px solid ${activeType===tp.id?C.ink:C.border}`, padding:'0.3rem 0.75rem', fontSize:'0.78rem', cursor:'pointer', whiteSpace:'nowrap', fontFamily:"'Be Vietnam Pro',sans-serif", transition:'all 0.15s', display:'flex', alignItems:'center', gap:4 }}>
            <span>{tp.icon}</span> {tp.label}
          </button>
        ))}
        <button onClick={() => setPicksOpen(o => !o)} aria-pressed={picksOpen} aria-controls="map-picks"
          style={{ background:picksOpen?'#E8A020':'white', color:picksOpen?C.ink:C.muted, border:`1px solid ${picksOpen?'#E8A020':C.border}`, padding:'0.3rem 0.8rem', fontSize:'0.78rem', cursor:'pointer', whiteSpace:'nowrap', fontFamily:"'Be Vietnam Pro',sans-serif", fontWeight:600, marginLeft:4 }}>
          {m.picksBtn}
        </button>
        <div style={{ marginLeft:'auto', display:'flex', gap:12, alignItems:'center', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.72rem', color:'#2E7D52' }}>
            <div style={{ width:10, height:10, background:'#2E7D52', borderRadius:'50%' }}/>
            {m.legendOn} {selMonth}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.72rem', color:C.muted }}>
            <div style={{ width:10, height:10, background:C.border, borderRadius:'50%' }}/>
            {m.legendOff}
          </div>
        </div>
      </div>

      {/* MAP */}
      <div style={{ flex:1, position:'relative' }}>
        {!mapReady && <div style={{ position:'absolute', inset:0, zIndex:10 }}><SkeletonMap/></div>}
        <div ref={containerRef} style={{ width:'100%', height:'100%', opacity:mapReady?1:0, transition:'opacity 0.4s' }}/>
        {tilesFailed && <div role="status" style={{ position:'absolute', left:60, right:12, top:12, zIndex:650, pointerEvents:'none', background:'rgba(255,248,225,0.95)', border:'1px solid rgba(232,160,32,0.5)', padding:'0.5rem 0.8rem', fontSize:'0.75rem', color:'#6B4E00' }}>{t.result.mapNoTiles}</div>}

        {/* MUST-SEE PICKS */}
        {picksOpen && (
          <aside id="map-picks" className="map-picks" aria-label={m.picksTitle} style={{ position:'absolute', top:12, right:12, bottom:36, width:'min(340px, calc(100% - 24px))', zIndex:700, background:'rgba(244,239,230,0.97)', border:`1px solid ${C.border}`, boxShadow:'0 8px 28px rgba(26,25,22,.16)', borderRadius:14, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'0.8rem 1rem 0.65rem', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'flex-start', gap:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.05rem' }}>⭐ {m.picksTitle}</div>
                <div style={{ fontSize:'0.7rem', color:C.muted }}>{m.picksSub(t.months[selMonth])}</div>
              </div>
              <button onClick={() => setPicksOpen(false)} aria-label={m.picksClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1rem', color:C.muted }}>✕</button>
            </div>
            <div style={{ overflowY:'auto', padding:'0.4rem 0.6rem 0.8rem', flex:1 }}>
              {picks.length === 0 && <p style={{ fontSize:'0.8rem', color:C.muted, padding:'0.8rem 0.4rem' }}>{m.picksEmpty}</p>}
              {picks.map(g => (
                <section key={g.type} style={{ marginTop:'0.7rem' }}>
                  <h4 style={{ fontSize:'0.68rem', letterSpacing:'0.1em', textTransform:'uppercase', color:TYPE_COLORS[g.type], margin:'0 0.4rem 0.3rem', display:'flex', gap:6, alignItems:'center' }}>
                    <span aria-hidden="true">{TYPE_ICONS[g.type]}</span>{types.find(x => x.id === g.type)?.label}
                  </h4>
                  {g.picks.map((k, i) => (
                    <button key={k.place.id} type="button" onClick={() => handleSelectSearch(k.place)}
                      style={{ display:'flex', gap:10, alignItems:'flex-start', width:'100%', textAlign:'left', background:selected?.id===k.place.id?C.rustLight:'white', border:'none', borderRadius:10, padding:'0.55rem 0.6rem', marginBottom:5, cursor:'pointer', fontFamily:"'Be Vietnam Pro',sans-serif", boxShadow:'0 1px 3px rgba(26,25,22,.08)', opacity:k.offSeason?0.7:1 }}>
                      <span aria-hidden="true" style={{ flexShrink:0, width:22, height:22, borderRadius:8, background:i===0?'#E8A020':'rgba(26,25,22,.08)', color:i===0?C.ink:C.muted, fontWeight:700, fontSize:'0.75rem', display:'flex', alignItems:'center', justifyContent:'center' }}>{i+1}</span>
                      <span style={{ flex:1, minWidth:0 }}>
                        <span style={{ display:'block', fontWeight:600, fontSize:'0.84rem', color:C.ink }}>{k.place.name}</span>
                        <span style={{ display:'block', fontSize:'0.69rem', color:C.muted, marginBottom:3 }}>{k.place.area} · {k.place.cost === 0 ? m.free : `${k.place.cost.toLocaleString('vi-VN')}đ`}</span>
                        <span style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {k.rating && <span style={{ fontSize:'0.62rem', padding:'0.08rem 0.45rem', borderRadius:999, fontWeight:700, background:'rgba(232,160,32,.16)', color:'#8A5A00' }}>★ {fmtAvg(k.rating.avg)} ({k.rating.n})</span>}
                          {k.reasons.filter(r => r !== 'rated' || !k.rating).map(r => <span key={r} style={{ fontSize:'0.62rem', padding:'0.08rem 0.45rem', borderRadius:999, fontWeight:600, background:r==='editor'?'rgba(232,160,32,.2)':r==='peak'?'rgba(46,125,82,.14)':'rgba(26,25,22,.06)', color:r==='editor'?'#8A5A00':r==='peak'?'#2E7D52':C.muted }}>{whyText[r]}</span>)}
                          {k.offSeason && <span style={{ fontSize:'0.62rem', padding:'0.08rem 0.45rem', borderRadius:999, background:'rgba(184,92,42,.12)', color:C.rust, fontWeight:600 }}>{m.whyOff}</span>}
                        </span>
                      </span>
                    </button>
                  ))}
                </section>
              ))}
              <p style={{ fontSize:'0.66rem', color:C.muted, lineHeight:1.55, margin:'0.9rem 0.4rem 0' }}>{anyRated ? m.picksHowRated : m.picksHow}</p>
            </div>
          </aside>
        )}

        {/* DETAIL PANEL */}
        {showPanel && selected && (
          <div style={{ position:'absolute', bottom:0, left:0, right:0, background:C.cream, borderTop:`2px solid ${C.border}`, padding:'1.1rem 1.25rem', display:'flex', gap:'1.25rem', alignItems:'flex-start', zIndex:800, maxHeight:'45vh', overflowY:'auto', boxShadow:'0 -4px 24px rgba(0,0,0,.12)' }}>
            <button onClick={() => setShowPanel(false)} style={{ position:'absolute', top:10, right:12, background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem', color:C.muted }}>✕</button>
            <div style={{ width:48, height:48, flexShrink:0, background:`${TYPE_COLORS[selected.type]||C.rust}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', border:`1px solid ${C.border}` }}>
              {TYPE_ICONS[selected.type]||'📍'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.1rem', lineHeight:1.2 }}>{selected.name}</h3>
                {inSeasonIds.has(selected.id) && (
                  <span style={{ background:'#2E7D52', color:'white', fontSize:'0.65rem', padding:'0.2rem 0.6rem', fontWeight:600, flexShrink:0 }}>✓ {m.inSeasonBadge.replace('✓ ','').toUpperCase()}</span>
                )}
              </div>
              <div style={{ fontSize:'0.72rem', color:C.muted, marginBottom:8, display:'flex', gap:10, flexWrap:'wrap' }}>
                <span>📍 {selected.area}</span>
                <span>⏱ {selected.duration} {m.min}</span>
                <span>💵 {selected.cost === 0 ? m.free : `${selected.cost.toLocaleString('vi-VN')}đ`}</span>
                <span>{selected.indoor ? m.indoor : m.outdoor}</span>
              </div>
              <p style={{ fontSize:'0.83rem', color:C.muted, lineHeight:1.65, marginBottom:8 }}>{selected.desc}</p>
              <div style={{ background:inSeasonIds.has(selected.id)?'rgba(46,125,82,0.08)':C.cream, border:`1px solid ${inSeasonIds.has(selected.id)?'rgba(46,125,82,0.25)':C.border}`, padding:'0.55rem 0.75rem', fontSize:'0.78rem', color:inSeasonIds.has(selected.id)?'#2E7D52':C.muted, marginBottom:8, lineHeight:1.55 }}>
                🗓 {selected.season}
              </div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                <span style={{ fontSize:'0.68rem', color:C.muted, marginRight:2 }}>{m.bestMonths}</span>
                {(selected.bestMonths || []).map(mn => (
                  <span key={mn} style={{ fontSize:'0.68rem', padding:'0.1rem 0.45rem', background:mn===selMonth?'#2E7D52':C.cream, color:mn===selMonth?'white':C.muted, border:`1px solid ${mn===selMonth?'#2E7D52':C.border}` }}>
                    {t.monthsS[mn]}
                  </span>
                ))}
              </div>
              {selected.tip && <div style={{ fontSize:'0.76rem', color:C.muted, fontStyle:'italic' }}>💡 {selected.tip}</div>}
              <PlaceRating placeId={selected.id} name={selected.name}/>
              {(() => { const on = mustIds.includes(selected.id), full = !on && mustIds.length >= MAX_MUST; return <button type="button" disabled={full} aria-pressed={on} onClick={() => onToggleMust?.(selected.id)} style={{ marginTop:8, fontSize:'0.76rem', padding:'0.4rem 0.8rem', cursor:full?'not-allowed':'pointer', opacity:full?0.5:1, fontFamily:"'Be Vietnam Pro',sans-serif", background:on?C.rust:'none', color:on?'white':C.ink, border:`1px solid ${on?C.rust:C.border}` }}>{on ? t.result.inPlan : full ? t.result.planFull : t.result.addToPlan}</button> })()}
            </div>
            <button onClick={onStart}
              style={{ background:C.ink, color:C.cream, border:'none', padding:'0.7rem 1.25rem', fontSize:'0.83rem', fontFamily:"'Be Vietnam Pro',sans-serif", fontWeight:500, cursor:'pointer', flexShrink:0, alignSelf:'center' }}
              onMouseEnter={e => e.currentTarget.style.background=C.rust}
              onMouseLeave={e => e.currentTarget.style.background=C.ink}>
              {m.ctaBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
