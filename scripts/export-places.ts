// Usage: npm run export:places  → writes hanoi-today-dia-diem-hien-tai.xlsx with the data currently in the app
// (a starting point if you'd rather edit what exists than begin from a blank template).
import ExcelJS from 'exceljs'
import { RAW_PLACES, SEASONS, LOCAL, SCHEDULE_DATA, STRENUOUS, MENUS_DATA } from '../src/data/dataset'
import { fillWorkbook } from './lib/export-xlsx'
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile('hanoi-today-dia-diem-moi.xlsx')
fillWorkbook(wb, { places: RAW_PLACES, seasons: SEASONS, local: LOCAL, schedule: SCHEDULE_DATA, strenuous: STRENUOUS, menus: MENUS_DATA })
await wb.xlsx.writeFile('hanoi-today-dia-diem-hien-tai.xlsx')
console.log(`Đã ghi hanoi-today-dia-diem-hien-tai.xlsx (${RAW_PLACES.length} địa điểm)`)
