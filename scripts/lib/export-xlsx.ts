// Fills the Excel template with a dataset (used by `npm run export:places` and the round-trip test).
import type { Workbook } from 'exceljs'
import type { Dataset } from './dataset'

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export function fillWorkbook(wb: Workbook, d: Dataset): void {
  const ws = wb.getWorksheet('Địa điểm')!
  const col = new Map<string, number>(); ws.getRow(2).eachCell((c, n) => col.set(String(c.value), n))
  const set = (r: number, h: string, v: unknown) => { const k = [...col.keys()].find(x => x === h || x.startsWith(h)); if (k && v !== undefined && v !== '') ws.getCell(r, col.get(k)!).value = v as never }
  ws.spliceRows(3, 1)   // drop the example row
  d.places.forEach((p, i) => {
    const r = 3 + i, s = d.seasons[p.id], l = d.local[p.id], sc = d.schedule[p.id]
    set(r, 'Mã (id)', p.id); set(r, 'Tên', p.name); set(r, 'Khu vực', p.area); set(r, 'Vĩ độ', p.lat); set(r, 'Kinh độ', p.lng)
    set(r, 'Loại', p.type); set(r, 'Tâm trạng', p.moods.join(', ')); set(r, 'Nhóm đi cùng', p.groups.join(', ')); set(r, 'Trong nhà', p.indoor ? 'Có' : 'Không')
    set(r, 'Thời điểm', p.timeOfDay.join(', ')); set(r, 'Thời lượng', p.duration); set(r, 'Chi phí', p.cost); set(r, 'Mô tả', p.desc)
    set(r, 'Nhãn', p.badges.join(', ')); set(r, 'Mẹo', p.tip); set(r, 'Giờ mở cửa', p.hours); set(r, 'Ngày nghỉ', p.closedNote)
    set(r, 'Địa chỉ', p.address); set(r, 'Ghi chú', p.note); set(r, 'Nổi bật', p.featured ? 'Có' : undefined)
    if (sc?.days) set(r, 'Chỉ mở các thứ', sc.days.map(x => DAY_NAMES[x]).join(', '))
    set(r, 'Giờ bắt đầu sớm nhất', sc?.openHour); set(r, 'Giờ cuối được vào', sc?.closeHour)
    set(r, 'Đi bộ nhiều', d.strenuous.includes(p.id) ? 'Có' : 'Không')
    if (s) { set(r, 'Tháng đẹp nhất', s.bestMonths.join(', ')); set(r, 'Ghi chú theo mùa', s.season) }
    if (l) { set(r, 'Điểm địa phương', l.localScore); set(r, 'Điểm ẩn', l.hiddenGem ? 'Có' : 'Không'); set(r, 'Mô tả cho khách', l.touristDesc); set(r, 'Mô tả người HN', l.localDesc); set(r, 'Mẹo người HN', l.localTip); set(r, 'Giờ người HN hay đến', l.localTime) }
    set(r, 'Ảnh', p.image); set(r, 'Nguồn / tác giả ảnh', p.imageCredit)
  })
  const ms = wb.getWorksheet('Thực đơn')!
  ms.spliceRows(2, 1)
  let r = 2
  for (const [id, m] of Object.entries(d.menus)) for (const it of m.items) {
    ms.getCell(r, 1).value = id; ms.getCell(r, 2).value = it.n; ms.getCell(r, 3).value = it.p; ms.getCell(r, 4).value = m.q
    ms.getCell(r, 5).value = m.checked ?? ''; ms.getCell(r, 6).value = (m.src ?? []).join(' ; ') || 'menu tại quán'; ms.getCell(r, 7).value = m.note ?? ''; r++
  }
}
