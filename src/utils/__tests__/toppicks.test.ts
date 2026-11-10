import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import path from 'node:path'
import { topPicksByType, scorePick, PICK_WEIGHTS, type SeasonFit } from '../topPicks'
import { parseWorkbook } from '../../../scripts/lib/parse-xlsx'
import { fillWorkbook } from '../../../scripts/lib/export-xlsx'
import { RAW_PLACES } from '../../data/dataset'
import { getPlaces } from '../../data/placeStore'
import { mergeSeasonsIntoPlaces, seasonLevel } from '../../data/seasons'
import type { Place } from '../../types'

const mk = (id: string, type: Place['type'], o: Partial<Place> = {}): Place => ({
  id, name: id, area: 'Hoàn Kiếm', lat: 21.03, lng: 105.85, type, moods: ['calm'], groups: ['solo'], indoor: false, timeOfDay: ['morning'], duration: 60, cost: 0, desc: 'x'.repeat(30), badges: ['a'], tip: 't', ...o,
})
const ok = (): SeasonFit => 'ok'

describe('topPicksByType', () => {
  it('editors\' ⭐ always beats everything else, even an off-season one', () => {
    const wide = mk('WIDE', 'food', { moods: ['calm', 'adventure', 'nostalgia', 'energy'], groups: ['solo', 'couple', 'friends', 'family'] })
    const star = mk('STAR', 'food', { featured: true })
    const [g] = topPicksByType([wide, star], p => (p.id === 'STAR' ? 'off' : 'peak'))
    expect(g.picks.map(k => k.place.id)).toEqual(['STAR', 'WIDE'])
    expect(g.picks[0].reasons).toContain('editor'); expect(g.picks[0].offSeason).toBe(true)
  })
  it('without a ⭐: peak month > fine > off-season, then wider appeal, then name (stable)', () => {
    const a = mk('A', 'cafe'), b = mk('B', 'cafe'), c = mk('C', 'cafe', { moods: ['calm', 'energy', 'adventure'], groups: ['solo', 'couple', 'friends'] }), d = mk('D', 'cafe')
    const fit = (p: Place): SeasonFit => (p.id === 'A' ? 'peak' : p.id === 'D' ? 'off' : 'ok')
    const [g] = topPicksByType([d, c, b, a], fit, 4)
    expect(g.picks.map(k => k.place.id)).toEqual(['A', 'C', 'B', 'D'])
    expect(topPicksByType([a, b, c, d], fit, 4)[0].picks.map(k => k.place.id)).toEqual(['A', 'C', 'B', 'D'])   // input order does not matter
  })
  it('limits per category, skips empty categories and lodging, and can focus one type', () => {
    const ps = [...'ABCDE'].map(i => mk('F' + i, 'food')).concat([mk('K1', 'cafe'), mk('L1', 'lodging')])
    const all = topPicksByType(ps, ok, 3)
    expect(all.map(g => g.type)).toEqual(['food', 'cafe']); expect(all[0].picks).toHaveLength(3)
    const one = topPicksByType(ps, ok, 5, ['food']); expect(one).toHaveLength(1); expect(one[0].picks).toHaveLength(5)
  })
  it('scores are explainable from the documented weights', () => {
    const p = mk('X', 'food', { featured: true, moods: ['calm', 'adventure', 'nostalgia', 'energy'], groups: ['solo', 'couple', 'friends', 'family'], season: 'Tháng 10-11 đẹp nhất.' })
    const k = scorePick(p, 'peak')
    expect(k.score).toBeCloseTo(PICK_WEIGHTS.editor + PICK_WEIGHTS.peak + PICK_WEIGHTS.wideMax, 5)
    expect(k.reasons).toEqual(['editor', 'peak', 'wide'])
  })
  it('works on the real dataset: every category present has picks, no duplicates, valid months', () => {
    const places = mergeSeasonsIntoPlaces(getPlaces())
    for (let month = 1; month <= 12; month++) {
      const groups = topPicksByType(places, p => seasonLevel(p.id, month), 3)
      const ids = groups.flatMap(g => g.picks.map(k => k.place.id))
      expect(new Set(ids).size).toBe(ids.length)
      expect(groups.length).toBeGreaterThanOrEqual(5)
      for (const g of groups) { expect(g.picks.length).toBeGreaterThan(0); expect(g.picks.every(k => k.place.type === g.type)).toBe(true) }
    }
  })
})

describe('Excel column "Nổi bật"', () => {
  it('round-trips featured places; blank / "Không" stay unset; junk gives a warning', async () => {
    const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path.join(__dirname, '../../../hanoi-today-dia-diem-moi.xlsx'))
    const places = RAW_PLACES.slice(0, 3).map((p, i) => ({ ...p, featured: i === 0 ? true : undefined }))
    fillWorkbook(wb, { places, seasons: {}, local: {}, schedule: {}, strenuous: [], menus: {} })
    const ws = wb.getWorksheet('Địa điểm')!; let col = 0; ws.getRow(2).eachCell((c, n) => { if (String(c.value).startsWith('Nổi bật')) col = n })
    expect(col).toBeGreaterThan(0)
    ws.getCell(5, col).value = 'có thể'      // third place: not understood
    const r = parseWorkbook(wb)
    expect(r.errors).toEqual([])
    expect(r.dataset.places.map(p => !!p.featured)).toEqual([true, false, false])
    expect(r.warnings.join('\n')).toMatch(/Nổi bật/)
  })
})
