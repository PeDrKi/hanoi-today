import { RAW_PLACES } from './dataset'
import { applyMenus } from './menus'
import type { RawPlace, Place } from '../types'

export { RAW_PLACES }

export const PLACES: Place[] = applyMenus(RAW_PLACES)

export const PLACES_STATS = {
  total: PLACES.length,
  indoor: PLACES.filter(p => p.indoor).length,
  outdoor: PLACES.filter(p => !p.indoor).length,
  free: PLACES.filter(p => p.cost === 0).length,
}
