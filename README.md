# Hà Nội Hôm Nay 🗺
> Hướng dẫn triển khai đầy đủ: xem [DEPLOY.md](DEPLOY.md).


> Hệ thống gợi ý lộ trình du lịch Hà Nội cá nhân hóa

## Chạy ngay

```bash
cd hanoi-today
npm install
npm run dev
# → http://localhost:3000
```

Không cần API key. Thuật toán gợi ý chạy hoàn toàn trên trình duyệt; Leaflet và jsPDF được đóng gói sẵn qua npm (không còn tải từ CDN). Chỉ cần mạng cho nền bản đồ OSM, thời tiết Open-Meteo và font Google.

```bash
npm test      # unit test cho thuật toán gợi ý (vitest)
npm run build # build production
```

## Tính năng

- **Map preview** — toàn bộ địa điểm (hiện 65) (mở từ link ở trang Welcome) trên bản đồ OSM, tìm kiếm, lọc theo mùa
- **Onboarding 4 bước** — tâm trạng, ngân sách, thời gian, nhóm
- **Local vs Tourist mode** — 2 góc nhìn khác nhau
- **A/B Compare** — so sánh 2 lộ trình song song  
- **4 tab kết quả** — Lộ trình / Bản đồ GIS / Chỗ ở / Đánh giá
- **Export PDF** — lộ trình + thông tin hệ thống
- **Admin dashboard** — quản lý địa điểm, xem đánh giá B4, dữ liệu B1
- **Tiếng Anh / Tiếng Việt** — toggle ngôn ngữ
- **Responsive mobile** — layout tốt trên mọi màn hình

## Thay đổi gần đây

- Admin sửa/thêm/xóa địa điểm nay **áp dụng thật** cho gợi ý lộ trình và bản đồ (lưu ở localStorage của trình duyệt, có kiểm tra tọa độ).
- Gợi ý biết **ngày/giờ mở cửa** (Lăng Bác, phố đi bộ — xem `src/data/schedule.js`), mở rộng mã thời tiết mưa, tính **thời gian di chuyển theo khoảng cách**, tối ưu tuyến thử mọi điểm xuất phát.
- Sau 21h lộ trình tự chuyển sang sáng hôm sau (có thông báo).
- Thoát HTML ở popup bản đồ (chống XSS), refresh thời tiết mỗi 30 phút, giữ kết quả khi tải lại trang, nhãn aria cho nút đánh giá sao.
- jsPDF và trang Admin được tải theo yêu cầu (code-splitting).

- **Vòng cải tiến UX:** thời lượng lộ trình bám theo lựa chọn (2h ≈ 2 tiếng, nửa ngày ≈ 4 tiếng), giờ làm tròn 15 phút, mỗi điểm phải hợp khung giờ và bán kính gần nhau; tab kết quả dạng lưới trên điện thoại; tab "Di chuyển & chi phí" (ẩn chỗ ở) cho hành trình dưới một ngày với chi phí tính từ vé + di chuyển thực tế; bản đồ gom cụm marker.

- **Tính năng mới:** chọn ngày/giờ bắt đầu ở bước 3; nút **Đổi điểm** cho từng chặng (thay bằng điểm phù hợp nhất, không đổi các điểm còn lại); **Chỉ đường** từng điểm và **Mở cả lộ trình** trên Google Maps; **Chia sẻ lộ trình** — URL (`#p=…`) chứa đúng danh sách điểm đang xem nên bạn bè mở ra thấy y hệt, không cần server.

- **Dữ liệu mùa:** mỗi địa điểm có thêm `peakMonths` (đỉnh mùa, suy ra từ mô tả mùa) — tháng 10 còn 16 điểm "đẹp nhất" thay vì 45/45; bản đồ mờ dần theo 3 mức (đẹp nhất / đi được / nên chọn tháng khác).
- **Sắp xếp thứ tự:** nút ↑ ↓ trên mỗi điểm, giờ tự tính lại; điểm bị đặt ngoài khung giờ đẹp/ngày đóng cửa được cảnh báo. "Đổi điểm" giữ nguyên thứ tự đã sắp.
- Onboarding 5 bước: chế độ Du khách/Người Hà Nội nay là câu hỏi riêng.

- **Độ bền & truy cập:** không còn màn hình trắng khi lỗi (ErrorBoundary + nút bắt đầu lại); bản đồ báo rõ khi không tải được nền (mạng chậm/bị chặn) mà vẫn dùng được danh sách; lựa chọn onboarding dùng được bằng bàn phím (Tab/Space/Enter) với viền focus; tôn trọng `prefers-reduced-motion`.
- **Triển khai:** `base: './'` nên chạy được ở thư mục con (GitHub Pages…); bundle chính giảm ~400 → ~250 KB nhờ tải trễ bản đồ/Admin/PDF; có meta mô tả & Open Graph.
- **PDF:** nay có mẹo từng điểm, link Google Maps cho cả lộ trình và link mở lại lộ trình trong app.

- **Trải nghiệm khi đi:** mỗi điểm có lý do gợi ý ("Hợp tâm trạng", "Đẹp nhất tháng 10", "Trong nhà, tránh mưa"…); giữa các điểm hiện thời gian/quãng đường; tóm tắt chuyến đi (số điểm, tổng thời lượng, km, vé); khi đang đi sẽ có nhãn **Đang diễn ra / Tiếp theo** và nút **Đã ghé** (nhớ theo ngày); thông báo khi trời mưa/nóng hoặc khi chỉ tìm được ít điểm hơn dự kiến; **Gợi ý nhanh** ở trang chủ và onboarding tự điền lại lựa chọn lần trước.
- Sửa lỗi ngày lệch về hôm trước khi dùng trước 7h sáng ở múi giờ Việt Nam (ảnh hưởng ngày mở cửa khi đổi điểm / mở link chia sẻ).

## Cấu hình tùy chọn (file `.env.local`)

```
VITE_ADMIN_PASSWORD=mat-khau-cua-ban       # đổi mật khẩu Admin (chỉ là cổng phía client, không thay thế bảo mật server)
VITE_REVIEW_ENDPOINT=https://script.google.com/macros/s/.../exec   # gửi thêm mỗi đánh giá về một URL dùng chung
```

Đánh giá luôn được lưu cục bộ; nếu đặt `VITE_REVIEW_ENDPOINT` thì còn được POST (JSON) tới URL đó — dùng Google Apps Script hoặc Formspree để gom đánh giá từ nhiều người. Admin có nút **Xuất CSV**.

## Vào Admin

- Nhấn nút **⚙ Quản trị hệ thống** ở trang Welcome
- Hoặc nhấn **Ctrl + Shift + A**
- Mật khẩu mặc định khi phát triển: `hanoi2025` (bản production không hiện gợi ý; đặt `VITE_ADMIN_PASSWORD` để đổi)

## Stack

| Layer | Công nghệ |
|---|---|
| Frontend | React 18 + Vite 5 |
| Bản đồ | Leaflet.js 1.9 + OpenStreetMap |
| Thời tiết | Open-Meteo API |
| PDF | jsPDF 2.5 (client-side, npm) |
| Test | Vitest |
| Thuật toán | Recommender System (Filter → Score → Select → Route) |
| i18n | VI / EN |

## Kiến trúc

```
Welcome → Map Preview → Onboard → Result
                                     ↓
                              [Lộ trình][Bản đồ][Chỗ ở][Đánh giá]
```

## Tổng quan dự án

**B1** — Phỏng vấn 20 du khách (dữ liệu trong `src/data/interviewData.js`)  
**B2** — Web hỗ trợ lộ trình (app này)  
**B3** — React + Leaflet + Recommender System  
**B4** — Tab Đánh giá + Admin dashboard  
**B5** — Sản phẩm cuối sau cải tiến từ B4

## v8 — Chỉ đi ăn / chỉ đi cà phê & giá trung bình menu
- Bước mới trong onboarding: **Tổng hợp / Chỉ đi ăn / Chỉ đi cà phê** (có trong link chia sẻ, "Kế hoạch nhanh" và chip ở đầu trang kết quả). Chế độ đơn loại bỏ giới hạn "tối đa 2 điểm cùng loại" và chọn cụm quán gần nhau nhất.
- **Giá quán ăn/cà phê = trung bình các món trong menu** (làm tròn 1.000đ), lấy từ `src/data/menus.js`. Mỗi thẻ có nút "Xem menu & nguồn giá" (món, giá, nguồn, ngày kiểm tra).
- Ba mức tin cậy, hiển thị rõ trên thẻ: `TB menu` (≥4 món có bảng giá công bố), `TB … (menu chưa đủ)` (ít món/giá từ đánh giá khách) và `Ước tính` (chưa có menu có nguồn — **chưa phải giá menu**).
- Hiện có menu đầy đủ: Bún chả Hương Liên, Kem Tràng Tiền, Xôi Yến. Menu một phần: Bánh Mì 25, Phở Bát Đàn, Phở 10 Lý Quốc Sư, Phở Thìn. Các quán còn lại đang là ước tính — bổ sung bằng cách thêm mục vào `MENUS` (chỉ ghi giá có nguồn).
- Thêm quán: Xôi Yến, Phở 10 Lý Quốc Sư, Bún chả Đắc Kim, Chả cá Thăng Long, Loading T Cafe, Cafe Phố Cổ; bỏ quán trùng (Cà phê trứng Giảng).

## v11 — UX/UI
- Mobile: tab cuộn ngang một hàng (dính đầu trang), thanh "Mở Google Maps / Chia sẻ" dính đáy màn hình.
- Giá quán ăn/cà phê nổi bật theo mức tin cậy (xanh = TB menu, vàng = chưa đủ/ước tính); lý do gợi ý gọn thành một dòng.
- Tổng kết chuyến chỉ ăn/cà phê ghi "ăn uống (ước tính)"; thêm Highlands, The Coffee House, Cộng Cà Phê.

## v12 — Gợi ý theo vị trí
- Bước "thời gian" có mục tuỳ chọn: **📍 Dùng vị trí của tôi** (Geolocation API, chỉ xin quyền khi bấm) hoặc chọn nhanh khu vực (Hồ Hoàn Kiếm, Phố cổ, Ba Đình, Tây Hồ, Hai Bà Trưng).
- Điểm đầu tiên được chọn gần người dùng (đổi 6 điểm số lấy 1 km), mỗi thẻ ghi "cách bạn X m/km". Vị trí ngoài Hà Nội bị bỏ qua; bị từ chối thì dùng như cũ.
- Vị trí không đưa vào link chia sẻ, không lưu lâu dài và không gửi đi đâu.

## v13 — Cài như ứng dụng & dùng offline (PWA)
- `manifest.webmanifest` + icon: có thể "Thêm vào màn hình chính" trên điện thoại.
- `sw.js`: sau lần mở đầu, app tải được khi mất mạng (lộ trình tính ngay trên máy). Thời tiết và nền bản đồ vẫn cần mạng.
- Service worker chỉ bật ở bản build (production), không ảnh hưởng `npm run dev`. Khi deploy lên sub-path, mọi đường dẫn đã là tương đối.

## v14 — Thêm 12 địa điểm (tổng ~61)
- Tham quan/bảo tàng: Hoàng thành Thăng Long, Cột cờ, Chùa Một Cột, Bảo tàng Lịch sử Quốc gia, Bảo tàng Mỹ thuật, Phủ Tây Hồ, Phố Tạ Hiện.
- Ăn uống: Bún thang Bà Đức, Bánh tôm Hàng Bồ, Cháo sườn cô Là, Quán Ăn Ngon, Bún nem Vương.
- **Cần kiểm tra:** toạ độ 7 điểm tham quan/bảo tàng đầu tiên là toạ độ địa danh gần đúng (sai số có thể vài trăm mét), chưa lấy từ nguồn số hoá; toạ độ 5 quán ăn lấy từ Foody/Michelin. Giá vé Hoàng thành (70-100k) và giờ mở Cột cờ đang mâu thuẫn giữa các nguồn.
- Bảo tàng Lịch sử Quốc gia & Hoàng thành: nghỉ thứ Hai (đã vào `schedule.js`).
- Chưa thêm (thiếu nguồn hoặc không phù hợp): chợ hoa Quảng An và chợ đầu mối Long Biên (hoạt động 2-5h sáng), Đường Lâm (xa), phố đường tàu (tình trạng cấm không rõ).

## v15 — Gợi ý ngay, không cần hỏi
- Nút chính ở trang đầu: **✨ Gợi ý cho tôi ngay** → ra lộ trình tức thì. Câu hỏi chi tiết vẫn có ở "Tự chọn chi tiết".
- `src/utils/infer.js` đoán nhu cầu từ giờ, thứ trong tuần, thời tiết và lựa chọn lần trước (mưa/nóng → yên tĩnh, tối → sôi động, cuối tuần → khám phá, sáng sớm → hoài niệm). Trang kết quả ghi rõ "Tự gợi ý theo: …".
- Thanh "chỉnh nhanh" trên đầu lộ trình: đổi tâm trạng / chỉ ăn / chỉ cà phê / độ dài chỉ bằng một chạm, lộ trình tính lại ngay.
- Nếu trình duyệt đã được cấp quyền vị trí từ trước thì tự dùng vị trí; không bao giờ tự bật hộp thoại xin quyền.

## Deploy miễn phí
Ứng dụng là web tĩnh (`npm run build` → `dist/`), nên deploy được miễn phí ở nhiều nơi:
- **GitHub Pages**: đẩy code lên GitHub, bật Settings → Pages → Source = GitHub Actions (đã có `.github/workflows/deploy.yml`). Địa chỉ dạng `https://<tên>.github.io/<repo>/` — chạy được vì `base: './'`.
- **Cloudflare Pages / Netlify / Vercel**: kết nối repo, lệnh build `npm run build`, thư mục `dist` (đã có `netlify.toml`).
- Lưu ý bảo mật: mọi biến `VITE_*` đều nằm trong mã gửi tới trình duyệt. Đừng đặt `VITE_GEMINI_KEY` trên bản public (hoặc giới hạn khoá theo HTTP referrer trong Google AI Studio). `VITE_ADMIN_PASSWORD` chỉ là rào chắn nhẹ, không thay thế đăng nhập thật.

## v17 — Cho người dùng thường xuyên
Giả lập 30 ngày dùng app (60 lộ trình) cho thấy bản cũ chỉ dùng 9/65 địa điểm và 4 lộ trình khác nhau. Sau khi sửa: 50/65 địa điểm, 60/60 lộ trình khác nhau, không có hai lộ trình liên tiếp giống nhau (có test trong `variety.test.js`).
- Biến thiên có kiểm soát: điểm cộng ngẫu nhiên ổn định theo (ngày, lần "Tạo lại", loại thời gian) — cùng ngày tải lại vẫn ra đúng lộ trình đó; sang ngày khác hoặc bấm "Tạo lại" thì khác.
- Bộ nhớ trên máy (`src/utils/memory.js`): điểm đã gợi ý trong 7 ngày qua bị trừ điểm; điểm đã bấm "Đã ghé" bị trừ nhiều hơn (quán ăn/cà phê ít hơn điểm tham quan); nút **Không hiện nữa** ẩn hẳn một điểm (bỏ ẩn ở trang đầu).
- Tâm trạng tự đoán xoay vòng theo ngày khi không có tín hiệu rõ (mưa/nóng/tối/cuối tuần vẫn được ưu tiên).

## v18 — Hoàn thiện cho người dùng thường xuyên
- **Độ phủ**: đo lại trên mọi tổ hợp đáp án — cả 65/65 điểm đều có thể xuất hiện, điểm nhiều nhất chỉ chiếm ≤ 12% (test `reach.test.js`). Đường "gợi ý ngay" dùng nhóm trung tính (`group:'any'`) thay vì mặc định "bạn bè", nên phủ 63/65 điểm trong 60 ngày (`auto.test.js`). Hạt giống ngẫu nhiên có thêm buổi trong ngày nên sáng/chiều/tối ra lộ trình khác nhau.
- **Trang "Của tôi"** (`MineScreen`): Muốn đi (♡ trên mỗi thẻ, được cộng điểm khi gợi ý), lịch sử gợi ý (mỗi ngày một lộ trình), đã ghé, đã ẩn (bỏ ẩn từng điểm).
- **Sao lưu / chuyển máy không cần server**: sao chép mã `HN1.…` rồi dán vào máy khác để khôi phục — dữ liệu được gộp, mã được kiểm tra chặt (id, ngày) trước khi nhập. Không có đồng bộ tự động vì app không có máy chủ.

## v19 — Đồng bộ tự động giữa các thiết bị

Yêu thích / đã ghé / đã ẩn / lịch sử tự đồng bộ giữa các máy, **không cần tài khoản**.

- Máy 1: **Của tôi → Bật đồng bộ** → hiện mã 20 ký tự. Máy 2: nhập mã đó → **Kết nối**.
- Dữ liệu được mã hoá đầu-cuối (AES-GCM, khoá suy ra từ mã bằng PBKDF2); server chỉ thấy bản mã. Ai có mã đều đọc/sửa được — giữ kín.
- Gộp kiểu last-write-wins theo từng mục (có "bia mộ" khi bỏ tim/bỏ ẩn), nên sửa ở hai máy cùng lúc không mất dữ liệu.
- Tự đồng bộ: khi mở app, sau mỗi thay đổi (trễ 2,5 s), khi quay lại tab, khi có mạng lại. Mã sao lưu thủ công (HN2.) vẫn dùng được.

### Triển khai server đồng bộ
> Từ v22 server dùng **Cloudflare D1**, xem mục v22 bên dưới (thay cho KV).

## v20 — Chuyển sang TypeScript

- Toàn bộ `src/` (và `sync-server/`, `vite.config.ts`) đã sang `.ts/.tsx`, `strict: true`. Kiểu dùng chung nằm ở `src/types.ts` (`Place`, `Answers`, `Plan`, `Stop`, `MemoryState`, …); bản dịch EN bị ép khớp khoá của VI (`EN: typeof VI`).
- `npm run typecheck` chạy `tsc`; `npm run build` = `tsc && vite build` nên lỗi kiểu chặn build.
- Server đồng bộ chạy thử cục bộ: `npm run sync-server` (dùng `tsx`). Worker Cloudflare: `sync-server/worker.ts` (wrangler build TS trực tiếp).
- `src/utils/api.js` (Gemini) giữ nguyên là JavaScript, không đụng tới.
- Sửa kèm: khôi phục từ mã sao lưu luôn thắng bản "xoá" cùng mili-giây.

## v21 — Rà soát toàn bộ
- Nâng `jspdf` lên 4.x (xoá 2 cảnh báo `npm audit` mức critical/moderate); đã kiểm tra lại xuất PDF trên trình duyệt thật.
- Số địa điểm ở trang đầu lấy từ dữ liệu thật (trước đó ghi cứng "45").

## v22 — Database dùng chung (Cloudflare D1)

Một Worker + một D1 (SQLite miễn phí) lưu ba thứ:

| Bảng | Nội dung | Ai truy cập |
|---|---|---|
| `sync` | Dữ liệu cá nhân (yêu thích, đã ghé, đã ẩn, lịch sử) — **đã mã hoá đầu-cuối**, khoá khoá là mã đồng bộ, không cần tài khoản | Ai có mã |
| `places` | Danh sách địa điểm; Admin sửa là mọi người thấy ở lần mở app kế tiếp | Đọc: công khai · Ghi: Admin |
| `reviews` | Đánh giá của người dùng (được lọc, giới hạn độ dài và số lượng) | Gửi: công khai · Đọc: Admin |

Ghi đồng bộ dùng so sánh-và-ghi nguyên tử trong SQL (`UPDATE … WHERE rev = ?`), nên hai máy ghi cùng lúc không còn đè nhau và không còn lỗi "đọc bản cũ" như KV.
Đăng nhập Admin giờ do **server** kiểm tra bằng secret `ADMIN_TOKEN` (không còn mật khẩu nằm trong code trình duyệt khi đã cấu hình API).

### Triển khai
```bash
cd sync-server
npx wrangler login
npx wrangler d1 create hanoi-today                 # dán database_id vào wrangler.toml
npx wrangler d1 execute hanoi-today --remote --file=schema.sql
cd .. && npm run db:seed                           # sinh sync-server/seed.sql từ các địa điểm có sẵn
cd sync-server && npx wrangler d1 execute hanoi-today --remote --file=seed.sql
npx wrangler secret put ADMIN_TOKENS               # vd: chu:Xk39...dài-ngẫu-nhiên:editor,ban:Yq82...:viewer  (token ≥ 8 ký tự)
# sửa ALLOWED_ORIGIN trong wrangler.toml thành domain app, rồi:
npx wrangler deploy                                # in ra https://hanoi-today-api.<bạn>.workers.dev
```
Build app với `VITE_API_URL=https://hanoi-today-api.<bạn>.workers.dev` (biến cũ `VITE_SYNC_URL` vẫn dùng được).
Không đặt biến này → app chạy như trước, mọi thứ nằm trong trình duyệt.

Chạy thử cục bộ: `npm run sync-server` (SQLite trong RAM, token Admin `dev-admin`; đặt `DB_FILE=dev.db` để lưu ra file, `ADMIN_TOKEN=...` để đổi token), rồi `VITE_API_URL=http://localhost:8787 npm run dev`.

Lưu ý: nếu bảng `places` còn trống, app dùng dữ liệu có sẵn; Admin → **↺ Reset** sẽ nạp lại các địa điểm có sẵn lên server. Cập nhật địa điểm chỉ áp dụng từ lần mở app sau (app tải danh sách khi khởi động).

## v23 — Khu quản trị hoàn thiện hơn
- **Nhiều admin, có vai trò**: secret `ADMIN_TOKENS="tên:token:vai_trò,…"`. `editor` được sửa dữ liệu; `viewer` chỉ xem (nút sửa/xoá bị ẩn, server cũng từ chối). `ADMIN_TOKEN` cũ vẫn dùng được (= editor tên `admin`).
- **Quản lý đánh giá**: xoá từng đánh giá (editor, có xác nhận).
- **Thống kê**: số thiết bị đồng bộ, hoạt động 7/30 ngày, đánh giá mới 7 ngày.
- **Nhật ký thao tác** (tab 🧾): ai đã thêm/sửa/xoá địa điểm hay xoá đánh giá, lúc nào.
- **Chống spam đánh giá**: tối đa 5 đánh giá/giờ mỗi người (theo IP đã băm muối), kèm giới hạn tổng.
- **Di động**: Admin dùng được ở màn hình hẹp (thanh điều hướng ngang).
- **Trợ năng**: nhãn aria, hộp thoại có `role="dialog"`, phím Esc đóng, label gắn với ô nhập.
- **Lối vào**: mở `https://<site>/#admin` để vào thẳng trang đăng nhập Admin.

Hạn chế còn lại: chưa thử deploy trên tài khoản Cloudflare thật; không có CAPTCHA; khi **không** cấu hình API thì mật khẩu Admin chỉ là cổng phía trình duyệt; ai có mã đồng bộ thì đọc/sửa được dữ liệu của mã đó; mới 3 địa điểm có thực đơn đầy đủ.

## v24 — Rà soát dữ liệu địa điểm
- Gộp địa điểm trùng: `HN004` (Làng lụa Hà Đông) = `DD002` (Làng Vạn Phúc) → còn **64** địa điểm.
- Sửa toạ độ: Chả cá Lã Vọng (lệch ~450 m), Làng hoa Tây Tựu (lệch ~2,7 km), Bảo tàng Dân tộc học, Nhà thờ lớn, Hỏa Lò, Bảo tàng Hồ Chí Minh. Sửa quận: Tây Tựu → Bắc Từ Liêm, Dân tộc học → Cầu Giấy, Vạn Phúc → Hà Đông.
- Cập nhật giá vé theo nghị quyết HĐND Hà Nội: Văn Miếu 70.000đ, Đền Ngọc Sơn 50.000đ, Hỏa Lò 50.000đ.
- Chưa xác minh được toạ độ từng điểm bằng nguồn bản đồ (sandbox không truy cập được OSM/Google). Nên kiểm tra thêm bằng cách mở từng điểm trên Admin → Địa điểm.

### Đối chiếu địa điểm với Google Maps
`GOOGLE_MAPS_KEY=<khoá Geocoding API> npm run verify:places` (không có khoá thì dùng OpenStreetMap). Script so toạ độ của từng địa điểm với kết quả geocoder, in ra những điểm lệch hơn 150 m (`THRESHOLD=…`) và ghi `places-report.csv`. Cần chạy trên máy có internet.

## v26 — Đối chiếu toạ độ với geocoder (OpenStreetMap)
Áp dụng 14 toạ độ đã khớp tên + địa chỉ thật: Đền Ngọc Sơn, Chả cá Lã Vọng (14 Chả Cá), Văn Miếu, BT Hồ Chí Minh, Chùa Trấn Quốc, The Note Coffee (64 Lương Văn Can), Cà phê Đinh (13 Đinh Tiên Hoàng), BT Phụ nữ, Công viên Thống Nhất, Chợ Hàng Da, Phố Hàng Mã, Hồ Thiền Quang, Hoàng thành, Phủ Tây Hồ. Các dòng geocoder khớp nhầm địa điểm khác được bỏ qua. `verify-places` giờ giới hạn trong Hà Nội và gắn nhãn `WRONG MATCH`.

## Cập nhật sau khi deploy
| Bạn muốn… | Làm gì |
|---|---|
| Sửa/thêm/xoá một địa điểm, đổi giá, toạ độ | `https://<site>/#admin` → Địa điểm. Không cần deploy; người dùng thấy bản mới sau ≤ 1 phút. |
| Sửa nhiều địa điểm trong `src/data/places.ts` | `npm run db:push` (tạo `seed.sql` rồi ghi vào D1 từ xa). Không cần deploy lại. |
| Sửa giao diện / thuật toán / bản dịch | `npm test`, rồi đẩy code lên GitHub (Cloudflare Pages tự build) hoặc `npm run build` và tải thư mục `dist`. |
| Sửa backend (`sync-server/`) | `npm test`, rồi `npm run deploy:api`. |
| Đổi / thêm admin | `npx wrangler secret put ADMIN_TOKENS` (có hiệu lực ngay). |

Lưu ý:
- `db:push` **ghi đè** địa điểm cùng `id`, kể cả chỗ bạn đã sửa tay trong Admin. Với mỗi đợt sửa, chọn một nơi để sửa: file hoặc Admin.
- `db:push` **không xoá** địa điểm đã bỏ khỏi file (ví dụ `HN004`). Hãy xoá nó trong Admin.
- Dữ liệu đồng bộ cá nhân và đánh giá nằm ở bảng khác nên không bị ảnh hưởng.
- Nên nối Cloudflare Pages với GitHub ngay từ đầu để mỗi lần cập nhật chỉ là `git push`.

## Yêu cầu Node.js
Dùng **Node 22 LTS** (`>=22.13`). Test và dev-server dùng module `node:sqlite` có sẵn từ Node 22; Vite 5 và Vitest 2 tự chúng chỉ cần Node 18+. Nếu dùng `nvm`: `nvm use` (đọc `.nvmrc`). Khi deploy Cloudflare Pages, đặt biến `NODE_VERSION=22`.

## v29 — Giao diện bo góc và dễ dùng hơn
- Bo góc toàn bộ nút, ô nhập, thẻ, nhãn, hộp thoại, bảng và popup bản đồ (biến `--r-sm/md/lg/pill` trong `global.css`; style inline có `borderRadius` riêng vẫn được ưu tiên).
- Hiệu ứng nhấn (thu nhỏ nhẹ), đổ bóng khi di chuột, nút bấm lớn hơn trên điện thoại, ô nhập cỡ 16px để iOS không tự phóng to.
- Trang chào: "Của tôi" và "Xem bản đồ" thành hai nút viên thuốc; liên kết quản trị đậm hơn.
- `#admin` hoạt động cả khi app đang mở (lắng nghe `hashchange`).

## v30 — Nút không viền
Nút, nhãn, liên kết dạng nút, thẻ lựa chọn và nhãn thời tiết không còn viền; nút phụ dùng nền nhạt, trạng thái chọn thể hiện bằng màu nền. Ô nhập, thẻ địa điểm và bảng vẫn giữ viền mảnh để dễ nhận biết khi dùng. Toàn bộ nằm cuối `src/styles/global.css` — xoá khối "Borderless buttons" để quay lại bản có viền.

## v31 — Ảnh nền
- Ảnh nền do mình vẽ (SVG, nhẹ ~16 KB, không phụ thuộc bản quyền): bờ hồ Hoàn Kiếm với Tháp Rùa, Chùa Một Cột, Cột cờ, Nhà thờ lớn, nhà phố cổ, hoa sen. File: `public/bg/hanoi-hero.svg` (trang chào, đầy đủ) và `public/bg/hanoi-strip.svg` (dải đường chân trời mờ ở đáy các trang khác).
- Độ đậm theo trang: chào = đầy đủ, tuỳ chọn = vừa, kết quả / "Của tôi" = rất nhẹ, bản đồ và Admin = không có (class `bg-*` trên `<body>`, đặt trong `App.tsx`).
- **Dùng ảnh của bạn:** bỏ ảnh vào `public/bg/`, rồi đổi hai dòng `url(/bg/...)` ở cuối `src/styles/global.css`. Nên dùng ảnh ≤ 300 KB (JPG/WebP) để trang tải nhanh.

## v32 — Animation
- **Ảnh nền động** (SVG, chạy bằng CSS, không tốn JavaScript): mây trôi, mặt trời "thở", mặt hồ lấp lánh, hoa sen nhấp nhô, liễu đung đưa, cờ trên Cột cờ bay.
- **Giao diện:** chuyển trang mờ dần + trượt lên; trang chào xuất hiện lần lượt, logo lơ lửng, nút chính phát sáng nhẹ; các điểm dừng trong lộ trình hiện lần lượt và nhấc lên khi rê chuột; nút/lựa chọn nảy khi bật; thanh số liệu Admin chạy từ 0.
- **Giảm chuyển động:** khi hệ điều hành bật "Reduce motion", toàn bộ animation tắt và ảnh nền chuyển sang bản tĩnh (`public/bg/*-static.svg`).
- Muốn tắt hẳn animation nền: xoá `.cl`, `.sun`… trong thẻ `<style>` của `public/bg/hanoi-hero.svg`, hoặc đổi `hanoi-hero.svg` thành `hanoi-hero-static.svg` trong `global.css`.

## v33 — Ảnh địa điểm
Mỗi địa điểm có thể có ảnh; chưa có thì app hiện **ảnh bìa vẽ sẵn** theo loại (🍜 ăn uống, ☕ cà phê, 🏛 bảo tàng, 🌿 thiên nhiên, 🛍 chợ, ⛩ tham quan), nên giao diện không bao giờ trống. Ảnh hiện trong lộ trình, popup bản đồ, trang "Của tôi" và form Admin (có xem trước). Ảnh lỗi/không tải được tự quay về ảnh bìa.

Hai cách thêm ảnh thật:
1. **Theo tên file (nên dùng):** bỏ ảnh vào `public/places/` đặt tên theo mã địa điểm — `HK001.jpg`, `BD002.webp`… — rồi chạy `npm run images`. Lệnh báo còn bao nhiêu địa điểm chưa có ảnh, file nào không khớp mã, file nào nặng quá 400 KB. Ảnh nên rộng ~1000 px, ≤ 300 KB.
2. **Theo đường dẫn:** Admin → Địa điểm → Sửa → ô "Ảnh" (`https://…`), kèm "Nguồn / tác giả". Lưu vào D1, không cần deploy.

Về bản quyền: chỉ dùng ảnh bạn tự chụp, ảnh được cấp phép (Wikimedia Commons CC-BY/CC0, Unsplash…) hoặc có xin phép; điền tên tác giả vào "Nguồn ảnh" — app hiện nó ở góc ảnh. Một số trang chặn nhúng ảnh từ web khác (hotlink); nên tải về và dùng cách 1.
PDF xuất ra chưa kèm ảnh.

## v34 — Nâng cấp theo mẫu SapaSense

Chuyển các tính năng dùng chung của SapaSense sang Hà Nội (phần riêng của núi được thay bằng bản Hà Nội):

- **Khám phá** (`#`Trang chủ → 🧭): duyệt theo nhóm Tham quan / Ăn uống / Lưu trú, khu vực, giá, tìm kiếm; huy hiệu *Đang mở* khi địa điểm có `hours`; món nên thử và lễ hội (kèm nguồn, `src/data/guide.ts`).
- **Chỗ ở**: tab và loại `lodging` đã sẵn sàng, **dữ liệu để trống** — thêm trong Admin hoặc file Excel là hiện ra.
- **Ngân sách tự do + số người**: gõ `1,5tr`, `800k`… hoặc kéo thanh log; tổng chia theo đầu người. Link/dữ liệu cũ mức 1–5 vẫn đọc được.
- **Thời tiết thật**: nhiệt độ, mưa, tầm nhìn → ưu tiên điểm trong nhà khi mưa/nóng; cảnh báo an toàn (giông, ngập, nóng ≥ 33–37°C), cảnh báo nắng gắt 11–15h, gợi ý mang theo, nút "Thời tiết đổi? Đổi kế hoạch".
- **Cá nhân hoá**: thể lực hạn chế (tránh điểm đi bộ nhiều/leo cầu thang), "gọn trong một khu" (≤ 3 km quanh Hồ Hoàn Kiếm), cảnh báo dị ứng thực phẩm.
- **Kế hoạch đã lưu** + nút **Thêm vào lịch (.ics)**, tuyên bố miễn trừ trách nhiệm cuối trang, GSAP animation (tôn trọng *giảm chuyển động*).
- Trường mới cho địa điểm: `hours` (`08:00–17:00` hoặc `24/24`), `address`, `closedNote`, `note`; Admin có ô nhập tương ứng.
- Giữ nguyên các cải tiến riêng của Hà Nội: Admin phân quyền/nhật ký, UI bo góc không viền, nền SVG, hệ thống ảnh địa điểm.
- Thêm `LICENSE` (MIT), `vercel.json`, workflow GitHub Pages (chạy tay).

## v35 — Làm lại dữ liệu từ Excel + khảo sát SUS

**Dữ liệu địa điểm (làm lại từ đầu)**
1. Điền file mẫu `hanoi-today-dia-diem-moi.xlsx` (sheet *Hướng dẫn* giải thích từng cột; *Địa điểm*, *Thực đơn*).
2. Kiểm tra thử: `npm run import:places -- ten-file.xlsx --dry` — báo lỗi từng dòng bằng tiếng Việt, không ghi gì.
3. Nhập thật: `npm run import:places -- ten-file.xlsx` → ghi lại `src/data/dataset.ts` (địa điểm, mùa, góc nhìn địa phương, lịch mở cửa, điểm đi bộ nhiều, thực đơn).
4. Ảnh: bỏ file vào `public/places/` rồi `npm run images`. Sau đó `npm test && npm run build`, rồi `npm run db:push` để đưa lên D1.
- Muốn sửa dữ liệu hiện có thay vì bắt đầu trống: `npm run export:places` → `hanoi-today-dia-diem-hien-tai.xlsx`.
- Nếu đổi hết mã địa điểm, một số test dùng mã cũ (`HK001`, `HK002`, `LB002`, `TD003`…) trong `recommend.test.ts`/`sync.test.ts` cần sửa theo.

**Khảo sát nghiên cứu (B4)**: form đánh giá có mục tuỳ chọn *Khảo sát nghiên cứu* — thang SUS 10 câu (VI/EN) và 5 câu về yếu tố ngữ cảnh. Admin → Đánh giá hiển thị điểm SUS trung bình, SD, xếp loại, tương quan Pearson với ý định dùng; *Xuất CSV* có đủ cột SUS1–10 và `ctx_*` để phân tích tiếp bằng Excel/SPSS.

## v36 — Trải nghiệm
- Màn kết quả trên desktop: thẻ địa điểm chia ảnh trái / nội dung phải (thay vì dải ảnh rộng).
- Ghi chú lặp (nhắc dị ứng, "giá ước tính") chỉ hiện ở thẻ đầu tiên cần đến; cảnh báo dị ứng cụ thể (⚠) vẫn hiện ở mọi quán có nguy cơ.
- Thẻ Khám phá có khoảng cách dưới ảnh; nút thang điểm khảo sát đạt cỡ chạm 44px.

**Triển khai Vercel + Cloudflare**: xem `DEPLOY-VERCEL.md` (giao diện trên Vercel, máy chủ dữ liệu trên Cloudflare Workers + D1). Hướng dẫn cũ toàn Cloudflare vẫn ở `DEPLOY.md`.
