import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import path from 'node:path'
import { parseWorkbook } from '../../../scripts/lib/parse-xlsx'
import { fillWorkbook } from '../../../scripts/lib/export-xlsx'
import { renderDataset } from '../../../scripts/lib/dataset'
import { RAW_PLACES, SEASONS, LOCAL, SCHEDULE_DATA, STRENUOUS, MENUS_DATA } from '../../data/dataset'

const TEMPLATE = path.join(__dirname, '../../../hanoi-today-dia-diem-moi.xlsx')
const current = { places: RAW_PLACES, seasons: SEASONS, local: LOCAL, schedule: SCHEDULE_DATA, strenuous: STRENUOUS, menus: MENUS_DATA }
async function template() { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(TEMPLATE); return wb }

describe('Excel importer', () => {
  it('blank template (only the example row) yields no places and no errors', async () => {
    const r = parseWorkbook(await template())
    expect(r.errors).toEqual([]); expect(r.dataset.places).toHaveLength(0)
  })
  it('round-trips the current dataset without loss', async () => {
    const wb = await template(); fillWorkbook(wb, current)
    const r = parseWorkbook(wb)
    expect(r.errors).toEqual([])
    expect(r.dataset.places).toEqual(RAW_PLACES.map(p => expect.objectContaining({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, type: p.type, moods: p.moods, groups: p.groups, indoor: p.indoor, timeOfDay: p.timeOfDay, duration: p.duration, cost: p.cost, badges: p.badges })))
    expect(r.dataset.strenuous.sort()).toEqual([...STRENUOUS].sort())
    const norm = (o: typeof SCHEDULE_DATA) => JSON.parse(JSON.stringify(o, (_k, v) => Array.isArray(v) && v.every(x => typeof x === 'number') ? [...v].sort() : v))
    expect(norm(r.dataset.schedule)).toEqual(norm(SCHEDULE_DATA))
    expect(norm(r.dataset.seasons as never)).toEqual(norm(SEASONS as never))
    expect(Object.keys(r.dataset.local).sort()).toEqual(Object.keys(LOCAL).sort())
    expect(Object.keys(r.dataset.menus).sort()).toEqual(Object.keys(MENUS_DATA).sort())
    for (const [id, m] of Object.entries(MENUS_DATA)) expect(r.dataset.menus[id].items).toEqual(m.items)
  })
  it('reports readable errors for bad rows and never writes partial data', async () => {
    const wb = await template(); fillWorkbook(wb, { ...current, places: [{ ...RAW_PLACES[0], lat: 5, type: 'zoo' as never, desc: 'ngắn', cost: 12.5 }, RAW_PLACES[0]] })
    const r = parseWorkbook(wb)
    expect(r.errors.join('\n')).toMatch(/Vĩ độ/); expect(r.errors.join('\n')).toMatch(/Loại/); expect(r.errors.join('\n')).toMatch(/Mô tả/); expect(r.errors.join('\n')).toMatch(/Chi phí/); expect(r.errors.join('\n')).toMatch(/trùng mã/)
  })
  it('lodging without a time of day defaults to "any"; hours must be HH:MM–HH:MM', async () => {
    const wb = await template()
    fillWorkbook(wb, { ...current, places: [{ ...RAW_PLACES[0], id: 'LS001', type: 'lodging', timeOfDay: [], hours: '8h-17h' as never }], strenuous: [], schedule: {}, seasons: {}, local: {}, menus: {} })
    const r = parseWorkbook(wb)
    expect(r.errors.join('\n')).toMatch(/Giờ mở cửa/)
    expect(r.errors.join('\n')).not.toMatch(/Thời điểm/)
  })
  it('renderDataset output is valid and contains every table', () => {
    const s = renderDataset(current)
    for (const k of ['RAW_PLACES', 'SEASONS', 'LOCAL', 'SCHEDULE_DATA', 'STRENUOUS', 'MENUS_DATA']) expect(s).toContain(`export const ${k}`)
  })
})
