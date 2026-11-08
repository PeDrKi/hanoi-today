# Hướng dẫn triển khai chi tiết: Vercel (giao diện) + Cloudflare (máy chủ dữ liệu)

Tài liệu viết cho người **chưa từng deploy**. Làm lần lượt từ Phần 0 đến Phần 7, đừng nhảy bước. Mỗi bước có "Kết quả mong đợi" để bạn biết đã làm đúng chưa.

**Hai phần của dự án**
- **Giao diện** (trang web người dùng thấy) → đăng trên **Vercel**.
- **Máy chủ dữ liệu** (đồng bộ giữa máy, đánh giá, Admin, danh sách địa điểm) → đăng trên **Cloudflare** (Workers + D1).

Cả hai miễn phí. Gói miễn phí Vercel (Hobby) dành cho dự án **phi thương mại**. Hạn mức miễn phí của cả hai nền tảng có thể thay đổi, hãy xem lại trang giá. Mình **chưa thử** triển khai trên tài khoản thật, nên nếu gặp lỗi lạ hãy xem Phần 7.

Thời gian làm lần đầu: khoảng 45–60 phút.

---

## Phần 0. Chuẩn bị (làm một lần)

### 0.1 Tạo 3 tài khoản (đều miễn phí)
1. **GitHub**: https://github.com/signup
2. **Cloudflare**: https://dash.cloudflare.com/sign-up (không cần thẻ thanh toán cho gói miễn phí)
3. **Vercel**: https://vercel.com/signup → chọn **Continue with GitHub** (đăng nhập bằng tài khoản GitHub ở bước 1, sau này Vercel đọc được repo của bạn).

### 0.2 Cài phần mềm trên máy
| Phần mềm | Cài ở đâu | Kiểm tra |
|---|---|---|
| **Node.js 22 LTS** (bản 22.13 trở lên) | https://nodejs.org → tải bản **LTS** | Mở terminal gõ `node -v` → phải ra `v22.x.x` |
| **Git** | https://git-scm.com/downloads | `git --version` |
| **Trình soạn thảo** (để sửa file cấu hình) | VS Code https://code.visualstudio.com (hoặc Notepad cũng được) | |

**Terminal là gì?** Windows: bấm phím Windows, gõ `PowerShell`, Enter. Mac: mở ứng dụng *Terminal*.

Nếu `node -v` ra số nhỏ hơn 22.13, hãy tải lại Node.js bản LTS mới nhất rồi mở lại terminal.

### 0.3 Giải nén và chạy thử trên máy
1. Giải nén `hanoi-today-v37.zip` → được thư mục `hanoi-today`. Nên đặt ở nơi đường dẫn ngắn, không dấu, ví dụ `C:\projects\hanoi-today` hoặc `~/projects/hanoi-today`.
2. Mở terminal **ngay trong thư mục đó**:
   - Windows: mở thư mục trong File Explorer, bấm vào thanh địa chỉ, gõ `powershell`, Enter.
   - Mac/Linux: `cd ~/projects/hanoi-today`
3. Chạy:
```bash
npm install
npm test
npm run build
```
**Kết quả mong đợi**: `npm test` kết thúc bằng dòng kiểu `Tests  127 passed`; `npm run build` kết thúc bằng `✓ built in …s`. Nếu `npm install` báo lỗi phiên bản Node, quay lại 0.2.

(Tuỳ chọn) chạy thử trên máy: `npm run dev` rồi mở địa chỉ nó in ra (thường `http://localhost:5173`). Tắt bằng `Ctrl + C`.

---

## Phần 1. Đưa code lên GitHub

### 1.1 Tạo kho (repo) trống
1. Vào https://github.com/new
2. **Repository name**: `hanoi-today`
3. Chọn **Private** (riêng tư; Vercel Hobby vẫn đọc được repo riêng của bạn) hoặc Public nếu muốn công khai mã.
4. **Không** tích "Add a README", "Add .gitignore", "Choose a license" (dự án đã có sẵn).
5. Bấm **Create repository**. Trang kế tiếp hiện địa chỉ dạng `https://github.com/<ten-ban>/hanoi-today.git`. Hãy copy nó.

### 1.2 Đẩy code lên
Trong terminal (đang ở thư mục `hanoi-today`):
```bash
git init
git add .
git commit -m "hanoi-today"
git branch -M main
git remote add origin https://github.com/<ten-ban>/hanoi-today.git
git push -u origin main
```
- Lần đầu, Git có thể hỏi tên: chạy `git config --global user.name "Ten Ban"` và `git config --global user.email "email@cua.ban"` rồi `git commit` lại.
- Khi `git push`, một cửa sổ trình duyệt hiện ra để **đăng nhập GitHub** → làm theo. Nếu nó hỏi mật khẩu trong terminal, GitHub **không** nhận mật khẩu thường: tạo *Personal Access Token* ở https://github.com/settings/tokens (quyền `repo`) rồi dán vào chỗ mật khẩu.

**Kết quả mong đợi**: tải lại trang repo trên GitHub thấy đầy đủ thư mục `src`, `sync-server`, `public`… **Không** được thấy file `.env` hay thư mục `node_modules` (chúng đã được loại trừ sẵn).

---

## Phần 2. Máy chủ dữ liệu trên Cloudflare (làm TRƯỚC giao diện)

Mọi lệnh dưới đây chạy trong terminal ở thư mục `hanoi-today`, trừ khi có ghi khác.

### 2.1 Đăng nhập Cloudflare
```bash
cd sync-server
npx wrangler login
```
Trình duyệt mở ra → bấm **Allow**. Quay lại terminal thấy `Successfully logged in`.
(Lần đầu `npx` có thể hỏi `Ok to proceed? (y)` → gõ `y`, Enter.)

### 2.2 Tạo cơ sở dữ liệu D1
```bash
npx wrangler d1 create hanoi-today
```
Terminal in ra một đoạn có dòng:
```
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```
- **Copy chuỗi `xxxxxxxx-…`**.
- Nếu Wrangler hỏi *"Would you like Wrangler to add it on your behalf?"* → chọn **No** (file đã có sẵn chỗ khai báo, mình sẽ dán tay).

Mở file `sync-server/wrangler.toml` bằng VS Code/Notepad, tìm dòng:
```
database_id = "PASTE_D1_DATABASE_ID_HERE"
```
và thay bằng chuỗi vừa copy, giữ nguyên dấu ngoặc kép. Lưu file.

### 2.3 Tạo bảng trong cơ sở dữ liệu
Vẫn đang ở thư mục `sync-server`:
```bash
npx wrangler d1 execute hanoi-today --remote --file=schema.sql
```
Nếu hỏi xác nhận (`Ok to proceed?`) → gõ `y`. **Kết quả mong đợi**: có chữ `success` hoặc số lệnh đã chạy, không có chữ `error`.

### 2.4 Nạp danh sách địa điểm
Quay về thư mục gốc rồi chạy:
```bash
cd ..
npm run db:push
```
**Kết quả mong đợi**: dòng `seed.sql: 64 places` (số địa điểm của bạn) rồi `success`.

### 2.5 Đặt mật khẩu cho màn Admin
Mỗi người quản trị có một "token" (như mật khẩu dài). Tạo token ngẫu nhiên, chạy lệnh này **2 lần** để có 2 token:
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```
Ví dụ in ra `9f3a…` (48 ký tự). **Ghi lại** vào chỗ an toàn (trình quản lý mật khẩu).

Rồi đặt:
```bash
npx wrangler secret put ADMIN_TOKENS --config sync-server/wrangler.toml
```
Khi được hỏi giá trị, dán một dòng theo mẫu `tên:token:quyền`, nhiều người cách nhau dấu phẩy, **không có khoảng trắng**:
```
chu:TOKEN_CUA_BAN:editor,thay:TOKEN_THU_HAI:viewer
```
- `editor` = được sửa/xoá dữ liệu. `viewer` = chỉ xem.
- Khi gõ/dán, màn hình **không hiện** gì cả, đó là bình thường. Bấm Enter.
- Nếu hỏi *"There doesn't seem to be a Worker called … Do you want to create one?"* → chọn **Yes**.

### 2.6 Đăng máy chủ lên
```bash
npm run deploy:api
```
**Kết quả mong đợi**: cuối cùng in ra một địa chỉ như
```
https://hanoi-today-api.<ten-cua-ban>.workers.dev
```
**Copy và ghi lại địa chỉ này** (gọi là *địa chỉ Worker*).

### 2.7 Kiểm tra máy chủ
Mở trình duyệt vào `<địa chỉ Worker>/v1/places`. **Mong đợi**: một trang chữ dài dạng JSON liệt kê các địa điểm. Nếu thấy lỗi → Phần 7.

---

## Phần 3. Giao diện trên Vercel

1. Vào https://vercel.com/new (đăng nhập bằng GitHub).
2. Mục **Import Git Repository**: nếu chưa thấy `hanoi-today`, bấm **Adjust GitHub App Permissions** và cho phép Vercel truy cập repo này. Bấm **Import** cạnh `hanoi-today`.
3. Màn **Configure Project**:
   - **Framework Preset**: `Vite` (tự nhận).
   - **Build Command**: `npm run build` · **Output Directory**: `dist` (đã khớp sẵn qua file `vercel.json`).
   - Mở **Environment Variables**, thêm từng dòng (Name → Value → **Add**):

     | Name | Value |
     |---|---|
     | `VITE_API_URL` | địa chỉ Worker ở 2.6, **không có dấu `/` ở cuối** |
     | `VITE_GEMINI_KEY` | khoá Gemini của bạn (lấy miễn phí ở https://aistudio.google.com, xem `.env.example`) |
     | `VITE_ADMIN_PASSWORD` | (không bắt buộc) một mật khẩu chặn thêm ở trình duyệt |

   - Mọi biến `VITE_*` đều **hiện công khai** trong mã trang web. Hãy giới hạn khoá Gemini trong Google AI Studio.
4. Bấm **Deploy**. Chờ 1–3 phút.
5. **Chọn phiên bản Node**: sau khi xong, vào **Settings → General → Node.js Version** → chọn **22.x** → **Save**. Rồi vào tab **Deployments** → bấm dấu `⋯` ở lần deploy mới nhất → **Redeploy**.

**Kết quả mong đợi**: Vercel hiện pháo hoa và địa chỉ dạng `https://hanoi-today-xxxx.vercel.app`. **Ghi lại địa chỉ này** (gọi là *địa chỉ site*). Mở lên sẽ thấy trang chủ.

Lúc này trang chạy được nhưng **đồng bộ, đánh giá, Admin chưa dùng được** vì máy chủ chưa cho phép site của bạn gọi tới. Làm tiếp Phần 4.

---

## Phần 4. Cho phép site gọi máy chủ (CORS)

Máy chủ chỉ nhận yêu cầu từ đúng tên miền của bạn. Việc này ngăn người lạ dùng máy chủ của bạn.

1. Mở lại `sync-server/wrangler.toml`, tìm:
```toml
[vars]
ALLOWED_ORIGIN = "https://YOUR-SITE.pages.dev"
```
2. Thay bằng địa chỉ site của bạn: đúng từng chữ, bắt đầu `https://`, **không** có dấu `/` ở cuối, ví dụ:
```toml
ALLOWED_ORIGIN = "https://hanoi-today-xxxx.vercel.app"
```
3. Lưu, rồi đăng lại máy chủ (ở thư mục gốc):
```bash
npm run deploy:api
```
4. Mở lại site, **tải lại trang (Ctrl + F5)**.

Lưu ý: `ALLOWED_ORIGIN` chỉ nhận **một** tên miền. Các địa chỉ xem thử (preview) của Vercel có tên miền khác nên không gọi được máy chủ, đó là bình thường. Nếu sau này bạn gắn tên miền riêng (ví dụ `hanoihomnay.vn`) thì đổi dòng này sang tên miền đó và `deploy:api` lại.

---

## Phần 5. Kiểm tra sau khi deploy

Đánh dấu từng mục:
- [ ] Mở site **trên điện thoại**, bấm "Gợi ý cho tôi ngay" ra được lộ trình; bản đồ hiện đúng.
- [ ] Mở `<địa chỉ site>/#admin` → đăng nhập bằng token **editor** → thấy danh sách địa điểm, thống kê, nhật ký.
- [ ] Đăng nhập bằng token **viewer** → không thấy nút Sửa/Xoá.
- [ ] Ở màn kết quả, tab **Đánh giá** → gửi một đánh giá thử (có thể điền cả mục Khảo sát nghiên cứu) → vào Admin → **Đánh giá** thấy nó → xoá nó đi.
- [ ] Đồng bộ: ở máy A tạo mã đồng bộ, nhập ở máy B, đánh dấu yêu thích ở A, kiểm tra B có cập nhật.
- [ ] Tắt mạng rồi mở lại site: app vẫn chạy (PWA).
- [ ] Mở `https://<địa chỉ site>/admin` có vào được (không 404).

---

## Phần 6. Cập nhật về sau

| Bạn muốn… | Làm gì |
|---|---|
| Sửa giao diện, thuật toán, bản dịch | Sửa file → `npm test` → `git add . && git commit -m "mô tả" && git push` → **Vercel tự build và đăng lại** (1–3 phút) |
| Sửa vài địa điểm | `<site>/#admin` → Địa điểm → sửa → lưu (không cần deploy; người dùng thấy sau tối đa 1 phút) |
| Làm lại toàn bộ dữ liệu từ Excel | `npm run import:places -- file.xlsx --dry` (thử) → `npm run import:places -- file.xlsx` → `npm test` → `npm run db:push` → `git push` |
| Thêm ảnh địa điểm | Bỏ ảnh vào `public/places/` (tên = mã địa điểm) → `npm run images` → `git push` |
| Sửa máy chủ (thư mục `sync-server/`) | `npm test` → `npm run deploy:api`. **Vercel không tự cập nhật phần này** |
| Đổi / thêm / bớt người quản trị | `npx wrangler secret put ADMIN_TOKENS --config sync-server/wrangler.toml` (dán lại **toàn bộ** danh sách) |
| Đổi biến `VITE_*` | Vercel → Settings → Environment Variables → sửa → **Redeploy** (biến chỉ có hiệu lực ở lần build sau) |

**Cảnh báo**: `npm run db:push` **ghi đè** địa điểm cùng mã (kể cả chỗ bạn sửa tay trong Admin) và **không xoá** địa điểm đã bỏ khỏi file. Mỗi đợt chỉ nên chọn **một** nơi để sửa dữ liệu: hoặc Admin, hoặc file Excel/`db:push`.

---

## Phần 7. Sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `node -v` ra số nhỏ hơn 22.13 | Cài lại Node.js LTS mới nhất, mở terminal mới |
| `npm install` báo lỗi về phiên bản | Như trên |
| `git push` bị từ chối hoặc hỏi mật khẩu | Đăng nhập GitHub qua cửa sổ trình duyệt, hoặc dùng Personal Access Token (Phần 1.2) |
| `wrangler login` không mở trình duyệt | Copy đường link nó in ra, dán vào trình duyệt |
| `d1 execute` báo `database_id` sai hoặc `No such database` | Chưa dán đúng `database_id` vào `wrangler.toml` (2.2) |
| `db:push` báo lỗi chưa có bảng | Chưa chạy bước 2.3 |
| `secret put` báo cần đăng nhập hoặc tên Worker | Chạy `npx wrangler login` lại; trả lời Yes khi hỏi tạo Worker |
| Mở `/v1/places` thấy lỗi hoặc trang trống | Chưa chạy `db:push` (2.4) hoặc chưa `deploy:api` (2.6) |
| Build trên Vercel lỗi về phiên bản Node | Đặt Node 22.x ở Settings → General rồi Redeploy |
| App báo "đồng bộ chưa được bật" | Thiếu `VITE_API_URL` hoặc chưa Redeploy sau khi thêm |
| Console (F12) báo lỗi **CORS**, không tải được địa điểm/đánh giá | `ALLOWED_ORIGIN` sai (thừa `/`, sai tên miền), chưa `deploy:api` sau khi sửa, hoặc bạn đang mở bản preview |
| Admin báo token sai | Token < 8 ký tự, có khoảng trắng thừa, hoặc chưa `secret put` lại sau khi đổi |
| `/admin` báo 404 | Dùng `/#admin`, hoặc kiểm tra `vercel.json` còn mục `rewrites` |
| Sửa code xong site không đổi | Chưa `git push`, hoặc Vercel đang build (xem tab Deployments) |

Nếu vẫn kẹt: chụp **toàn bộ thông báo lỗi** (terminal hoặc F12 → Console) và nói rõ bạn đang ở **bước nào**, gửi lại để được chỉ chỗ sửa.

---

## Phần 8. Giới hạn cần biết
- Bản hướng dẫn này **chưa được thử trên tài khoản Vercel/Cloudflare thật** nên một số màn hình có thể khác chút so với mô tả.
- Máy chủ dữ liệu không tự cập nhật khi `git push`; phải chạy `npm run deploy:api`.
- Mã Admin bằng `VITE_ADMIN_PASSWORD` chỉ là rào cản ở trình duyệt; bảo vệ thật sự nằm ở token Admin trên máy chủ.
- Các hạn mức và chính sách miễn phí của Vercel/Cloudflare do họ quyết định và có thể đổi.
