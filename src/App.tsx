import { useState, useEffect, lazy, Suspense } from 'react'
import WelcomeScreen    from './screens/WelcomeScreen'
import { decodePlan }   from './utils/share'
import { inferAnswers } from './utils/infer'
import type { ExtraPlace } from './utils/extraPlaces'
import { validOrigin, MAX_MUST } from './utils/recommend'
const MapPreviewScreen = lazy(() => import('./screens/MapPreviewScreen'))
const ExploreScreen = lazy(() => import('./screens/ExploreScreen'))
import OnboardScreen    from './screens/OnboardScreen'
import ResultScreen     from './screens/ResultScreen'
const AdminScreen = lazy(() => import('./screens/AdminScreen'))
import MineScreen       from './screens/MineScreen'
import WeatherBadge     from './components/WeatherBadge'
import Disclaimer       from './components/Disclaimer'
import { WX_MAP }       from './data/constants'
import { startAutoSync } from './utils/sync'
import { reducedMotion } from './utils/motion'
import { refreshRemotePlaces } from './data/placeStore'
import { ALLERGENS } from './data/health'
import { loadSavedPlan } from './utils/savedPlan'
import { normalizeBudget, clampPeople } from './utils/budget'
import type { Answers, Weather } from './types'
import './styles/global.css'

const isAdminUrl = () => window.location.hash === '#admin' || /\/admin\/?$/.test(window.location.pathname)
type Page = 'welcome' | 'explore' | 'map-preview' | 'onboard' | 'result' | 'mine' | 'admin'

const SS_KEY = 'hn_session'
const LAST_KEY = 'hn_last'
function loadLast(): Answers | null {
  try {
    const a = JSON.parse(localStorage.getItem(LAST_KEY) || 'null')
    if (a && a.mood && a.time && a.group && Number.isInteger(a.budget)) return { mood:a.mood, budget:normalizeBudget(a.budget), people:clampPeople(a.people), time:a.time, group:a.group, mode:a.mode === 'local' ? 'local' : 'tourist', focus:['food', 'cafe'].includes(a.focus) ? a.focus : 'all', ...(a.fitness === 'limited' ? { fitness:'limited' as const } : {}), ...(a.compact ? { compact:true } : {}), ...(Array.isArray(a.allergies) && a.allergies.length ? { allergies:a.allergies.filter((x: unknown) => typeof x === 'string' && x in ALLERGENS) } : {}) }
  } catch { /* ignore */ }
  return null
}
function saveLast(a: Answers) {
  try { localStorage.setItem(LAST_KEY, JSON.stringify({ mood:a.mood, budget:a.budget, people:a.people || 1, time:a.time, group:a.group, mode:a.mode, focus:a.focus || 'all', fitness:a.fitness, compact:a.compact, allergies:a.allergies })) } catch { /* ignore */ }
}

function loadShared() {
  try { return decodePlan(window.location.hash) } catch { return null }
}
function loadSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SS_KEY) || 'null')
    if (s && s.page === 'result' && s.answers) return s
  } catch { /* ignore */ }
  return null
}
function saveSession(page: Page, answers: Answers | null) {
  try {
    if (page === 'result' && answers) sessionStorage.setItem(SS_KEY, JSON.stringify({ page, answers }))
    else sessionStorage.removeItem(SS_KEY)
  } catch { /* ignore */ }
}

export default function App() {
  const [shared,  setShared]  = useState(loadShared)
  const [init]                = useState(loadSession)
  const [page,    setPage]    = useState<Page>(isAdminUrl() ? 'admin' : shared ? 'result' : (init?.page || 'welcome'))
  const [answers, setAnswers] = useState<Answers | null>(shared?.answers || init?.answers || null)
  const [wx,      setWx]      = useState<Weather | null>(null)

  useEffect(() => { saveSession(page, answers) }, [page, answers])
  useEffect(() => startAutoSync(), [])
  useEffect(() => { const c = document.body.classList; c.toggle('bg-hero', page === 'welcome'); c.toggle('bg-soft', page === 'onboard'); c.toggle('bg-faint', page === 'result' || page === 'mine'); c.toggle('bg-none', page === 'admin' || page === 'map-preview') }, [page])
  // parallax: on the welcome screen the skyline drifts a little against the pointer (mouse only; off for touch and reduced motion)
  useEffect(() => {
    if (page !== 'welcome' || reducedMotion() || !window.matchMedia?.('(pointer:fine)').matches) return
    const root = document.documentElement; let raf = 0
    const move = (e: PointerEvent) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { root.style.setProperty('--mx', String((e.clientX / window.innerWidth - 0.5) * 2)); root.style.setProperty('--my', String((e.clientY / window.innerHeight - 0.5) * 2)) }) }
    window.addEventListener('pointermove', move)
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); root.style.removeProperty('--mx'); root.style.removeProperty('--my') }
  }, [page])
  useEffect(() => { const h = () => { if (window.location.hash === '#admin') setPage('admin') }; window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h) }, [])
  useEffect(() => { refreshRemotePlaces() }, [])

  // Fetch Hanoi weather (temperature, rain, visibility) on mount and refresh every 10 minutes
  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch('https://api.open-meteo.com/v1/forecast?latitude=21.03&longitude=105.85&current=temperature_2m,precipitation,weather_code,visibility&timezone=Asia%2FBangkok')
        if (!res.ok) throw new Error('weather ' + res.status)
        const data = await res.json()
        const cur  = data.current
        const code = cur.weather_code
        const temp = Math.round(cur.temperature_2m)
        const precip = Number(cur.precipitation) || 0
        const visibility = Number.isFinite(Number(cur.visibility)) ? Number(cur.visibility) : undefined
        setWx(prev => (prev && prev.code === code && prev.temp === temp && prev.precip === precip && prev.visibility === visibility)
          ? prev
          : { ...(WX_MAP[code as keyof typeof WX_MAP] || { icon:'🌤', label:'Bình thường' }), temp, code, precip, visibility })
      } catch {
        setWx(prev => prev || { icon:'🌤', label:'Hà Nội', temp:'--' })
      }
    }
    load()
    const id = setInterval(load, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Ctrl+Shift+A → admin shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.ctrlKey && e.shiftKey && (e.code === 'Digit1' || e.code === 'KeyA')) { e.preventDefault(); setPage('admin') } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const [mustIds, setMustIds] = useState<string[]>([])
  const [extras, setExtras] = useState<ExtraPlace[]>([])
  const addExtra = (e: ExtraPlace) => setExtras(x => x.some(y => y.id === e.id) || x.length >= MAX_MUST ? x : [...x, e])
  const removeExtra = (id: string) => setExtras(x => x.filter(y => y.id !== id))
  const toggleMust = (id: string) => setMustIds(m => m.includes(id) ? m.filter(x => x !== id) : m.length >= MAX_MUST ? m : [...m, id])
  const goAdmin   = () => setPage('admin')
  const goOnboard = () => setPage('onboard')
  const goResult  = (ans: Answers) => { saveLast(ans); setShared(null); setAnswers(ans); setPage('result') }
  const goQuick   = () => {
    setShared(null); setAnswers({ ...inferAnswers({ now: new Date(), wx, last: loadLast() }), ...(mustIds.length ? { must: mustIds } : { must: undefined }), ...(extras.length ? { extras } : {}) }); setPage('result')
    // refine with the position only if the browser already has permission — never prompts by itself
    try {
      navigator.permissions?.query({ name:'geolocation' }).then(st => {
        if (st.state !== 'granted') return
        navigator.geolocation.getCurrentPosition(pos => {
          const loc = { lat:pos.coords.latitude, lng:pos.coords.longitude, src:'gps' as const }
          if (validOrigin(loc)) setAnswers(a => a && a.auto ? { ...a, loc } : a)
        }, () => {}, { timeout:4000, maximumAge:300000 })
      }).catch(() => {})
    } catch { /* ignore */ }
  }
  const adjust    = (patch: Partial<Answers>) => setAnswers(a => (a ? { ...a, ...patch, auto:false } : a))
  const goRestart = () => { try { window.history.replaceState(null, '', window.location.pathname) } catch { /* ignore */ } setShared(null); setAnswers(null); setPage('onboard') }
  const goHome    = () => {
    try { if (isAdminUrl()) window.history.replaceState(null, '', window.location.pathname.replace(/\/admin\/?$/, '/') || '/') } catch { /* ignore */ }
    setPage('welcome')
  }
  const goExplore = () => setPage('explore')
  const goSaved   = () => { const sp = loadSavedPlan(); if (!sp) return; setShared({ answers: sp.answers, ids: sp.ids, startHour: sp.startHour, dateISO: sp.dateISO } as any); setAnswers(sp.answers); setPage('result') }
  const goMap     = () => setPage('map-preview')
  const goMine    = () => setPage('mine')

  // result page already shows the weather in its header; badge would cover the PDF / restart buttons
  const showWeather = page === 'welcome' || page === 'onboard'

  return (
    <>
      {showWeather && <WeatherBadge wx={wx}/>}

      <div key={page} className="page-in">
      {page === 'welcome'     && <WelcomeScreen    onStart={goOnboard}   onAdmin={goAdmin} onMap={goMap} onExplore={goExplore} onQuick={goQuick} onMine={goMine} onSaved={loadSavedPlan() ? goSaved : undefined}/>}
      {page === 'explore'     && <Suspense fallback={<div style={{ padding:'3rem', textAlign:'center' }}>…</div>}><ExploreScreen wx={wx} onHome={goHome} onPlan={goQuick} mustIds={mustIds} onToggleMust={toggleMust} extras={extras} onAddExtra={addExtra} onRemoveExtra={removeExtra}/></Suspense>}
      {page === 'map-preview' && <Suspense fallback={<div style={{ padding:'3rem', textAlign:'center' }}>…</div>}><MapPreviewScreen onStart={goOnboard} onHome={goHome} mustIds={mustIds} onToggleMust={toggleMust}/></Suspense>}
      {page === 'onboard'     && <OnboardScreen    onDone={goResult} initial={{ ...loadLast(), ...(mustIds.length ? { must: mustIds } : {}), ...(extras.length ? { extras } : {}) }}/>}
      {page === 'result'      && answers && <ResultScreen answers={answers} wx={wx} onRestart={goRestart} onAdjust={adjust} shared={shared ? { ids:shared.ids, startHour:shared.startHour, dateISO:shared.dateISO } : null}/>}
      {page === 'mine'        && <MineScreen onHome={goHome}/>}
      {page === 'admin'       && <Suspense fallback={null}><AdminScreen onExit={goHome}/></Suspense>}
      </div>
      {page !== 'admin' && page !== 'map-preview' && <Disclaimer/>}
    </>
  )
}
