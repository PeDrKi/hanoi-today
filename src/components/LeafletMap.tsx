import { useRef, useEffect, useCallback, useState } from 'react'
import type { Stop } from '../types'
import { useT } from '../i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { escapeHtml } from '../utils/html'
import { C, MARKER_COLORS } from '../styles/tokens'
import { reducedMotion } from '../utils/motion'

export default function LeafletMap({ stops, route }: { stops?: Pick<Stop, 'lat' | 'lng' | 'name' | 'time' | 'desc' | 'image'>[]; route?: [number, number][] | null }) {
  const t = useT()
  const [tilesFailed, setTilesFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const layersRef    = useRef<L.LayerGroup | null>(null)

  const render = useCallback(() => {
    if (!containerRef.current) return

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center:[21.028, 105.854], zoom:12,
        zoomControl:true, scrollWheelZoom:true,
      })
      let loaded = 0, failed = 0
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:'© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom:19,
      })
      tiles.on('tileload', () => { loaded++ })
      tiles.on('tileerror', () => { failed++; if (failed >= 3 && loaded === 0) setTilesFailed(true) })
      tiles.addTo(mapRef.current)
    }

    if (layersRef.current) layersRef.current.clearLayers()
    else layersRef.current = L.layerGroup().addTo(mapRef.current)
    const layers = layersRef.current

    const valid = (stops || []).filter(s => s.lat && s.lng)
    if (!valid.length) return

    const latlngs: L.LatLngTuple[] = valid.map(s => [s.lat, s.lng])

    valid.forEach((stop, i) => {
      const color = MARKER_COLORS[i % MARKER_COLORS.length]
      const icon = L.divIcon({
        className:'',
        html:`<div class="pin-drop" style="animation-delay:${reducedMotion() ? 0 : 450 + i * 110}ms"><div class="custom-pin" style="background:${color}"><span>${i+1}</span></div></div>`,
        iconSize:[28,28], iconAnchor:[14,28], popupAnchor:[0,-30],
      })
      L.marker([stop.lat, stop.lng], { icon })
        .addTo(layers)
        .bindPopup(`
          <div>
            ${stop.image ? `<img src="${escapeHtml(stop.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:100%;max-width:220px;height:96px;object-fit:cover;border-radius:10px;margin-bottom:6px;display:block" onerror="this.remove()">` : ''}
            <div style="font-weight:600;margin-bottom:3px;color:#1A1916">${escapeHtml(stop.name)}</div>
            <div style="font-size:11px;color:#B85C2A;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">${escapeHtml(stop.time)}</div>
            <div style="font-size:12px;color:#7A746E;line-height:1.5">${escapeHtml((stop.desc||'').length>110?stop.desc.slice(0,110)+'…':stop.desc)}</div>
          </div>
        `)
    })

    if (latlngs.length > 1) {
      if (route && route.length > 1) {
        L.polyline(route, { color:'#fff', weight:8, opacity:.9, lineJoin:'round' }).addTo(layers)
        L.polyline(route, { color:C.rust, weight:5, opacity:.95, lineJoin:'round' }).addTo(layers)
      } else {
        L.polyline(latlngs, { color:C.rust, weight:2.5, opacity:.65, dashArray:'8,6' }).addTo(layers)
      }
    }

    // dolly & zoom: the camera starts wide over the city and glides in to frame the route (plain fit when motion is reduced)
    const box = L.latLngBounds(route && route.length > 1 ? [...latlngs, ...route] : latlngs)
    if (reducedMotion()) mapRef.current.fitBounds(box, { padding:[44,44] })
    else mapRef.current.flyToBounds(box, { padding:[44,44], duration:1.25, easeLinearity:0.22 })
  }, [stops, route])

  useEffect(() => { render() }, [render])
  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; layersRef.current = null }, [])

  return (
    <div style={{ position:'relative', border:`1px solid ${C.border}` }}>
      <div style={{
        position:'absolute', top:10, left:10, zIndex:500,
        background:'rgba(244,239,230,0.9)', backdropFilter:'blur(6px)',
        border:`1px solid ${C.border}`, padding:'0.3rem 0.7rem',
        fontSize:'0.65rem', color:C.muted, letterSpacing:'0.08em', textTransform:'uppercase',
      }}>
        OpenStreetMap · Leaflet GIS
      </div>
      <div ref={containerRef} style={{ height:380, width:'100%' }}/>
      {tilesFailed && <div role="status" style={{ position:'absolute', left:10, right:10, bottom:34, zIndex:500, background:'rgba(255,248,225,0.95)', border:'1px solid rgba(232,160,32,0.5)', padding:'0.45rem 0.7rem', fontSize:'0.72rem', color:'#6B4E00' }}>{t.result.mapNoTiles}</div>}
    </div>
  )
}
