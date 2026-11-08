import { LOCAL } from './dataset'
import type { Place, Mode } from '../types'

export interface LocalInfo { localScore: number; hiddenGem: boolean; touristDesc: string; localDesc: string; localTip: string; localTime: string }
export const LOCAL_MODE: Record<string, LocalInfo> = LOCAL

export function mergeLocalMode(places: Place[], mode: Mode = 'tourist'): Place[] {
  return places.map(p => {
    const lm = LOCAL_MODE[p.id]
    if (!lm) return p
    return {
      ...p,
      localScore:  lm.localScore,
      hiddenGem:   lm.hiddenGem || false,
      desc:        mode === 'local' ? lm.localDesc    : lm.touristDesc,
      tip:         mode === 'local' ? lm.localTip     : p.tip,
      displayTime: mode === 'local' ? lm.localTime    : null,
    }
  })
}
