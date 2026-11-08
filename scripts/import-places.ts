// Usage: npm run import:places -- path/to/hanoi-today-dia-diem-moi.xlsx [--dry]
// Reads the Excel template, validates every row, and (if there are no errors) rewrites src/data/dataset.ts.
import { writeFileSync, existsSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { parseWorkbook } from './lib/parse-xlsx'
import { renderDataset } from './lib/dataset'

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--')) || 'hanoi-today-dia-diem-moi.xlsx'
const dry = args.includes('--dry')
if (!existsSync(file)) { console.error(`Không thấy file: ${file}`); process.exit(1) }
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(file)
const { dataset: d, errors, warnings } = parseWorkbook(wb)
if (warnings.length) console.log(`\nCảnh báo (${warnings.length}):\n` + warnings.slice(0, 40).map(w => '  - ' + w).join('\n') + (warnings.length > 40 ? `\n  … và ${warnings.length - 40} cảnh báo nữa` : ''))
if (errors.length) { console.error(`\nLỖI (${errors.length}) — chưa ghi gì:\n` + errors.map(e => '  ✗ ' + e).join('\n')); process.exit(1) }
if (!d.places.length) { console.error('\nFile không có địa điểm nào (đã bỏ qua dòng VÍ DỤ). Chưa ghi gì.'); process.exit(1) }
console.log(`\nOK: ${d.places.length} địa điểm · ${Object.keys(d.menus).length} có thực đơn · ${Object.keys(d.local).length} có góc nhìn địa phương · ${Object.keys(d.seasons).length} có mùa · ${Object.keys(d.schedule).length} có lịch mở cửa · ${d.strenuous.length} điểm đi bộ nhiều`)
if (dry) { console.log('(--dry) không ghi file.'); process.exit(0) }
writeFileSync(new URL('../src/data/dataset.ts', import.meta.url), renderDataset(d))
console.log('Đã ghi src/data/dataset.ts. Chạy tiếp: npm run images && npm test && npm run build')
