import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseOsrm, stepText, legUrl, fetchRoute } from '../routing'

const good = {
  code: 'Ok',
  routes: [{
    distance: 3200, duration: 540,
    geometry: { coordinates: [[105.85, 21.03], [105.86, 21.04]] },
    legs: [{ distance: 3200, duration: 540, steps: [
      { distance: 100, name: 'Hàng Bạc', maneuver: { type: 'depart' }, geometry: { coordinates: [[105.85, 21.03], [105.855, 21.035]] } },
      { distance: 900, name: 'Lê Thái Tổ', maneuver: { type: 'turn', modifier: 'left' }, geometry: { coordinates: [[105.855, 21.035], [105.86, 21.04]] } },
      { distance: 0, name: '', maneuver: { type: 'arrive' } },
    ] }],
  }],
}
afterEach(() => vi.restoreAllMocks())

describe('routing', () => {
  it('parses OSRM output, swapping lng/lat to lat/lng', () => {
    const p = parseOsrm(good)!
    expect(p.coords[0]).toEqual([21.03, 105.85])
    expect(p.legs[0].coords).toEqual([[21.03, 105.85], [21.035, 105.855], [21.035, 105.855], [21.04, 105.86]])
    expect(p.km).toBeCloseTo(3.2); expect(p.min).toBe(9)
    expect(p.legs[0].steps.map(s => s.text)).toEqual(['Xuất phát trên Hàng Bạc', 'Rẽ trái vào Lê Thái Tổ', 'Đến nơi'])
  })
  it('rejects bad payloads', () => {
    expect(parseOsrm({ code: 'NoRoute' })).toBeNull()
    expect(parseOsrm(null)).toBeNull()
    expect(parseOsrm({ code: 'Ok', routes: [{ geometry: { coordinates: [[NaN, 1]] } }] })).toBeNull()
  })
  it('turn text', () => {
    expect(stepText({ distance: 5, maneuver: { type: 'turn', modifier: 'sharp right' } })).toBe('Rẽ gấp sang phải')
    expect(stepText({ distance: 5, name: 'X', maneuver: { type: 'roundabout' } })).toContain('vòng xuyến')
  })
  it('google links use the right travel mode', () => {
    const a = { lat: 1, lng: 2 }, b = { lat: 3, lng: 4 }
    expect(legUrl(a, b, 'bus')).toContain('travelmode=transit')
    expect(legUrl(a, b, 'motorbike')).toContain('travelmode=two-wheeler')
    expect(legUrl(a, b, 'car')).toContain('travelmode=driving')
  })
  it('fetchRoute: no network call for bus / one point; null on failure; caches success', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => good })
    vi.stubGlobal('fetch', f)
    const a = { lat: 21.03, lng: 105.85 }, b = { lat: 21.04, lng: 105.86 }
    expect(await fetchRoute([a, b], 'bus')).toBeNull()
    expect(await fetchRoute([a], 'car')).toBeNull()
    expect(f).not.toHaveBeenCalled()
    expect(await fetchRoute([a, b], 'car')).not.toBeNull()
    expect(await fetchRoute([a, b], 'motorbike')).not.toBeNull() // same geometry, cached
    expect(f).toHaveBeenCalledTimes(1)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')))
    expect(await fetchRoute([a, { lat: 20.9, lng: 105.8 }], 'walk')).toBeNull()
  })
})
