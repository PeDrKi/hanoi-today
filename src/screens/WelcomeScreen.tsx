import { Grain, BtnPrimary } from '../components/ui'
import LangToggle            from '../components/LangToggle'
import { C }                 from '../styles/tokens'
import { useT }              from '../i18n'
import { useState }          from 'react'
import { getPlaces }         from '../data/placeStore'
import { hiddenCount, clearHidden, favIds } from '../utils/memory'

interface Props { onStart: () => void; onAdmin: () => void; onMap: () => void; onQuick?: () => void; onMine: () => void; onExplore?: () => void; onSaved?: () => void }

export default function WelcomeScreen({ onStart, onAdmin, onMap, onQuick, onMine, onExplore, onSaved }: Props) {
  const t = useT().welcome
  const [hid, setHid] = useState(hiddenCount)
  return (
    <div className="welcome-veil" style={{ minHeight:'100vh', background:'transparent', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', textAlign:'center', position:'relative' }}>
      <Grain/>
      <div style={{ position:'fixed', top:'1.25rem', left:'1.25rem', zIndex:100 }}>
        <LangToggle/>
      </div>
      <div style={{ position:'absolute', top:'10%', left:'7%', width:110, height:110, borderRadius:'50%', border:`1px solid ${C.border}`, opacity:.45 }}/>
      <div style={{ position:'absolute', bottom:'12%', right:'8%', width:72, height:72, borderRadius:'50%', border:`1px solid ${C.border}`, opacity:.35 }}/>
      <div style={{ position:'relative', zIndex:1, width:56, height:56, borderRadius:'50%', border:`2px solid ${C.ink}`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Playfair Display',serif", fontSize:18, marginBottom:'2rem', animation:'spinSlow 20s linear infinite' }}>hn</div>
      <p style={{ position:'relative', zIndex:1, fontSize:'0.68rem', letterSpacing:'0.22em', textTransform:'uppercase', color:C.muted, marginBottom:'1rem' }}>{t.eyebrow}</p>
      <h1 className="welcome-title" style={{ position:'relative', zIndex:1, fontFamily:"'Playfair Display',serif", fontSize:'clamp(2.8rem,9vw,4.8rem)', lineHeight:1.02, marginBottom:'1.5rem' }}>
        {t.title1}<br/>
        <em style={{ color:C.rust, fontStyle:'italic' }}>{t.title2}</em><br/>
        {t.title3}
      </h1>
      <p style={{ position:'relative', zIndex:1, fontSize:'0.92rem', color:C.muted, maxWidth:340, margin:'0 auto 3rem', lineHeight:1.8, whiteSpace:'pre-line' }}>{t.subtitle}</p>
      {onQuick
        ? <BtnPrimary onClick={onQuick} style={{ position:'relative', zIndex:1 }}>{t.quickCta}</BtnPrimary>
        : <BtnPrimary onClick={onStart} style={{ position:'relative', zIndex:1 }}>{t.cta}</BtnPrimary>}
      {onQuick && (
        <button onClick={onStart} style={{ position:'relative', zIndex:1, marginTop:'0.9rem', background:'none', border:`1px solid ${C.border}`, color:C.ink, cursor:'pointer', fontSize:'0.88rem', padding:'0.65rem 1.4rem', fontFamily:"'Be Vietnam Pro',sans-serif" }}>
          {t.pickCta}
        </button>
      )}
      {hid > 0 && (
        <button type="button" onClick={() => { clearHidden(); setHid(0) }} style={{ position:'relative', zIndex:1, marginTop:'0.9rem', background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:'0.76rem', textDecoration:'underline', fontFamily:"'Be Vietnam Pro',sans-serif" }}>{t.unhide(hid)}</button>
      )}
      {(Boolean(onMine) || Boolean(onMap) || Boolean(onExplore) || Boolean(onSaved)) && (
        <div className="welcome-links">
          {onSaved && <button type="button" className="chip-btn" onClick={onSaved} style={{ color:C.ink }}>{t.savedLink}</button>}
          {onExplore && <button type="button" className="chip-btn" onClick={onExplore} style={{ color:C.ink }}>{t.exploreLink}</button>}
          {onMine && <button type="button" className="chip-btn" onClick={onMine} style={{ color:C.ink }}>{t.mineLink(favIds().length)}</button>}
          {onMap && <button type="button" className="chip-btn" onClick={onMap} style={{ color:C.rust }}>{t.mapLink(getPlaces().length)}</button>}
        </div>
      )}
      <button onClick={onAdmin} style={{ position:'relative', zIndex:1, marginTop:'1.25rem', background:'none', border:'none', cursor:'pointer', fontSize:'0.7rem', color:'rgba(26,25,22,.42)', fontFamily:"'Be Vietnam Pro',sans-serif", letterSpacing:'0.08em', transition:'color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.color = C.muted}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(26,25,22,.42)'}>
        {t.admin}
      </button>
    </div>
  )
}
