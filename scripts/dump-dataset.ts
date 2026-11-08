// One-off: writes the CURRENT built-in data into src/data/dataset.ts (run before refactor, kept for reference).
import { writeFileSync } from 'node:fs'
import { RAW_PLACES } from '../src/data/places'
import { SEASONS_DATA } from '../src/data/seasons'
import { LOCAL_MODE } from '../src/data/localMode'
import { SCHEDULE } from '../src/data/schedule'
import { STRENUOUS_IDS } from '../src/data/fitness'
import { MENUS } from '../src/data/menus'
import { renderDataset } from './lib/dataset'
writeFileSync(new URL('../src/data/dataset.ts', import.meta.url), renderDataset({ places: RAW_PLACES, seasons: SEASONS_DATA, local: LOCAL_MODE, schedule: SCHEDULE, strenuous: STRENUOUS_IDS, menus: MENUS }))
console.log('dataset.ts written:', RAW_PLACES.length, 'places')
