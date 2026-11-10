// Reads the Excel template (hanoi-today-dia-diem-moi.xlsx) and turns it into the dataset + a list of problems.
import type { Workbook, Cell } from 'exceljs'
import type { RawPlace, MenuEntry, MenuItem, Mood, Group, TimeOfDay, PlaceType } from '../../src/types'
import type { Dataset } from './dataset'

const TYPES: PlaceType[] = ['attraction', 'food', 'cafe', 'museum', 'nature', 'market', 'lodging']
const MOODS: Mood[] = ['calm', 'adventure', 'nostalgia', 'energy']
const GROUPS: Group[] = ['solo', 'couple', 'friends', 'family']
const TIMES: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'any']
const DAYS: Record<string, number> = { CN: 0, T2: 1, T3: 2, T4: 3, T5: 4, T6: 5, T7: 6 }
const HOURS_RE = /^(24\/24|\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}(\s*,\s*\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2})*)$/

export interface ParseResult { dataset: Dataset; errors: string[]; warnings: string[] }

function text(c: Cell | undefined): string {
  if (!c) return ''
  const v = c.value as unknown
  if (v == null) return ''
  if (typeof v === 'object') {
    const o = v as { richText?: { text: string }[]; text?: string; result?: unknown; hyperlink?: string }
    if (o.richText) return o.richText.map(r => r.text).join('').trim()
    if (o.text != null) return String(o.text).trim()
    if (o.result != null) return String(o.result).trim()
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    return ''
  }
  return String(v).trim()
}
const list = (s: string) => s.split(/[,;]/).map(x => x.trim()).filter(Boolean)
const yes = (s: string) => /^(có|co|yes|true|1|x)$/i.test(s.trim())
const no = (s: string) => /^(không|khong|no|false|0)$/i.test(s.trim())
const num = (s: string) => (s === '' ? NaN : Number(s.replace(',', '.')))
const isExample = (id: string, name: string) => /^ví dụ$/i.test(id) || /ví dụ/i.test(name)
/** "10/2026" → "2026-10"; "2026-10" stays. */
const monthKey = (s: string) => { const m = s.match(/^(\d{1,2})\/(\d{4})$/); return m ? `${m[2]}-${m[1].padStart(2, '0')}` : s }

export function parseWorkbook(wb: Workbook): ParseResult {
  const errors: string[] = [], warnings: string[] = []
  const ds: Dataset = { places: [], seasons: {}, local: {}, schedule: {}, strenuous: [], menus: {} }
  const ws = wb.getWorksheet('Địa điểm')
  if (!ws) { errors.push('Thiếu sheet "Địa điểm".'); return { dataset: ds, errors, warnings } }

  // header row = the row (1 or 2) that contains "Mã (id)"
  let hr = 0
  for (const r of [1, 2, 3]) if (ws.getRow(r).values && (ws.getRow(r).values as unknown[]).some(v => typeof v === 'string' && v.startsWith('Mã (id)'))) { hr = r; break }
  if (!hr) { errors.push('Không tìm thấy hàng tiêu đề (cột "Mã (id)").'); return { dataset: ds, errors, warnings } }
  const col = new Map<string, number>()
  ws.getRow(hr).eachCell((c, n) => col.set(text(c), n))
  const get = (row: number, name: string) => { const k = [...col.keys()].find(h => h === name || h.startsWith(name)); return k ? text(ws.getCell(row, col.get(k)!)) : '' }

  const seen = new Set<string>()
  for (let r = hr + 1; r <= ws.rowCount; r++) {
    const id = get(r, 'Mã (id)'), name = get(r, 'Tên')
    if (!id && !name) continue
    if (isExample(id, name)) continue
    const at = `Dòng ${r}${id ? ` (${id})` : ''}`
    const bad = (m: string) => errors.push(`${at}: ${m}`)
    if (!id) { bad('thiếu Mã (id)'); continue }
    if (seen.has(id)) { bad('trùng mã'); continue }
    seen.add(id)
    if (!name) bad('thiếu Tên')
    const area = get(r, 'Khu vực'); if (!area) bad('thiếu Khu vực')
    const lat = num(get(r, 'Vĩ độ')), lng = num(get(r, 'Kinh độ'))
    if (!Number.isFinite(lat) || lat < 20.7 || lat > 21.4) bad(`Vĩ độ "${get(r, 'Vĩ độ')}" không hợp lệ (20.7–21.4, dùng dấu chấm)`)
    if (!Number.isFinite(lng) || lng < 105.5 || lng > 106.1) bad(`Kinh độ "${get(r, 'Kinh độ')}" không hợp lệ (105.5–106.1)`)
    const type = get(r, 'Loại') as PlaceType
    if (!TYPES.includes(type)) bad(`Loại "${type}" không hợp lệ (${TYPES.join(', ')})`)
    const moods = list(get(r, 'Tâm trạng')) as Mood[]
    if (!moods.length || moods.some(m => !MOODS.includes(m))) bad(`Tâm trạng "${get(r, 'Tâm trạng')}" không hợp lệ (${MOODS.join(', ')})`)
    const groups = list(get(r, 'Nhóm đi cùng')) as Group[]
    if (!groups.length || groups.some(g => !GROUPS.includes(g))) bad(`Nhóm đi cùng "${get(r, 'Nhóm đi cùng')}" không hợp lệ (${GROUPS.join(', ')})`)
    const indoorRaw = get(r, 'Trong nhà')
    if (!yes(indoorRaw) && !no(indoorRaw)) bad('Trong nhà phải là Có hoặc Không')
    let times = list(get(r, 'Thời điểm')) as TimeOfDay[]
    if (!times.length && type === 'lodging') times = ['any']
    if (!times.length || times.some(t => !TIMES.includes(t))) bad(`Thời điểm "${get(r, 'Thời điểm')}" không hợp lệ (${TIMES.join(', ')})`)
    const duration = num(get(r, 'Thời lượng'))
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) bad('Thời lượng phải là số nguyên 1–1440 phút')
    const cost = num(get(r, 'Chi phí'))
    if (!Number.isInteger(cost) || cost < 0) bad('Chi phí phải là số nguyên ≥ 0 (ví dụ 50000)')
    const desc = get(r, 'Mô tả'); if (desc.length <= 20) bad('Mô tả phải dài hơn 20 ký tự')
    const badges = list(get(r, 'Nhãn')); if (!badges.length) bad('thiếu Nhãn')
    const tip = get(r, 'Mẹo'); if (!tip) bad('thiếu Mẹo')

    const p: RawPlace = { id, name, area, lat, lng, type, moods, groups, indoor: yes(indoorRaw), timeOfDay: times, duration, cost, desc, badges, tip }
    const hours = get(r, 'Giờ mở cửa'); if (hours) { if (HOURS_RE.test(hours)) p.hours = hours.replace(/\s+/g, ''); else bad(`Giờ mở cửa "${hours}" sai dạng (HH:MM–HH:MM hoặc 24/24)`) } else warnings.push(`${at}: chưa có Giờ mở cửa`)
    const opt = (k: keyof RawPlace, header: string) => { const v = get(r, header); if (v) (p as unknown as Record<string, string>)[k as string] = v }
    opt('closedNote', 'Ngày nghỉ'); opt('address', 'Địa chỉ'); opt('note', 'Ghi chú'); opt('image', 'Ảnh'); opt('imageCredit', 'Nguồn / tác giả ảnh')
    const feat = get(r, 'Nổi bật'); if (yes(feat)) p.featured = true; else if (feat && !no(feat)) warnings.push(`${at}: Nổi bật "${feat}" không rõ nghĩa (dùng Có / Không) — bỏ qua`)
    ds.places.push(p)

    // schedule
    const sch: { days?: number[]; openHour?: number; closeHour?: number } = {}
    const days = list(get(r, 'Chỉ mở các thứ')).map(d => d.toUpperCase())
    if (days.length) { if (days.some(d => !(d in DAYS))) bad(`Chỉ mở các thứ "${get(r, 'Chỉ mở các thứ')}" sai (T2…T7, CN)`); else sch.days = days.map(d => DAYS[d]).sort((a, b) => a - b) }
    for (const [h, k] of [['Giờ bắt đầu sớm nhất', 'openHour'], ['Giờ cuối được vào', 'closeHour']] as const) {
      const v = get(r, h); if (!v) continue
      const n = num(v); if (!Number.isInteger(n) || n < 0 || n > 23) bad(`${h} phải là số giờ 0–23`); else sch[k] = n
    }
    if (Object.keys(sch).length) ds.schedule[id] = sch
    // strenuous
    if (yes(get(r, 'Đi bộ nhiều'))) ds.strenuous.push(id)
    // seasons
    const months = list(get(r, 'Tháng đẹp nhất')).map(Number), seasonNote = get(r, 'Ghi chú theo mùa')
    if (months.length) { if (months.some(m => !Number.isInteger(m) || m < 1 || m > 12)) bad('Tháng đẹp nhất phải là số 1–12'); else ds.seasons[id] = { bestMonths: [...new Set(months)].sort((a, b) => a - b), season: seasonNote } }
    else if (seasonNote) warnings.push(`${at}: có Ghi chú theo mùa nhưng thiếu Tháng đẹp nhất — bỏ qua`)
    // local view
    const ls = get(r, 'Điểm địa phương')
    if (ls) {
      const n = num(ls)
      if (!Number.isInteger(n) || n < 1 || n > 5) bad('Điểm địa phương phải là số nguyên 1–5')
      else ds.local[id] = { localScore: n, hiddenGem: yes(get(r, 'Điểm ẩn')), touristDesc: get(r, 'Mô tả cho khách'), localDesc: get(r, 'Mô tả người HN'), localTip: get(r, 'Mẹo người HN'), localTime: get(r, 'Giờ người HN hay đến') }
    }
  }

  // menus
  const mws = wb.getWorksheet('Thực đơn')
  if (mws) {
    const byId = new Map<string, { items: MenuItem[]; q: Set<string>; checked: string[]; src: Set<string>; note: Set<string> }>()
    for (let r = 2; r <= mws.rowCount; r++) {
      const c = (n: number) => text(mws.getCell(r, n))
      const id = c(1), dish = c(2)
      if (!id && !dish) continue
      if (/^ví dụ$/i.test(id)) continue
      const at = `Thực đơn dòng ${r} (${id})`
      const place = ds.places.find(p => p.id === id)
      if (!place) { errors.push(`${at}: mã quán không có trong sheet Địa điểm`); continue }
      if (place.type !== 'food' && place.type !== 'cafe') warnings.push(`${at}: thực đơn chỉ dùng cho quán ăn/cà phê`)
      const price = num(c(3))
      if (!dish || !Number.isInteger(price) || price <= 0) { errors.push(`${at}: cần tên món và giá nguyên dương`); continue }
      const e = byId.get(id) ?? { items: [], q: new Set(), checked: [], src: new Set(), note: new Set() }
      e.items.push({ n: dish, p: price })
      if (c(4)) e.q.add(c(4)); if (c(5)) e.checked.push(monthKey(c(5))); if (c(6) && !/^menu tại quán$/i.test(c(6))) e.src.add(c(6)); if (c(7)) e.note.add(c(7))
      byId.set(id, e)
    }
    for (const [id, e] of byId) {
      const q = e.q.has('menu') && e.items.length >= 4 && ![...e.q].includes('partial') ? 'menu' : 'partial'
      if (e.q.has('menu') && q === 'partial') warnings.push(`Thực đơn ${id}: "menu" cần ≥ 4 món và không lẫn "partial" — hạ xuống partial`)
      const entry: MenuEntry = { q, items: e.items }
      if (e.checked.length) entry.checked = e.checked.sort().at(-1)
      if (e.src.size) entry.src = [...e.src]
      if (e.note.size) entry.note = [...e.note].join(' ')
      ds.menus[id] = entry
    }
  }
  return { dataset: ds, errors, warnings }
}
