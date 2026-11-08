import { STRENUOUS } from './dataset'
/** Stops that mean a lot of walking, queues in the sun or many steps. Review with local knowledge before relying on it. */
export const STRENUOUS_IDS: string[] = STRENUOUS
export const isStrenuous = (id: string): boolean => STRENUOUS_IDS.includes(id)
