@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title Hà Nội Hôm Nay - Cập nhật

:menu
cls
echo ==========================================
echo    HÀ NỘI HÔM NAY - CẬP NHẬT DỰ ÁN
echo ==========================================
echo.
echo   1. Cập nhật WEB  (kiểm tra, rồi đẩy lên GitHub, Vercel tự deploy)
echo   2. Cập nhật API  (deploy máy chủ Cloudflare)
echo   3. Cập nhật CẢ HAI
echo   4. Nhập Excel địa điểm mới, rồi cập nhật D1 và WEB
echo   5. Chỉ chạy kiểm tra (tsc, test, build)
echo   0. Thoát
echo.
set /p choice=Chọn (0-5):
if "%choice%"=="1" goto web
if "%choice%"=="2" goto api
if "%choice%"=="3" goto both
if "%choice%"=="4" goto excel
if "%choice%"=="5" goto check
if "%choice%"=="0" goto end
goto menu

:install
if not exist node_modules (
  echo [*] Chưa có node_modules, đang cài thư viện...
  call npm install
  if errorlevel 1 exit /b 1
)
exit /b 0

:verify
call :install
if errorlevel 1 exit /b 1
echo.
echo [1/3] Kiểm tra kiểu (tsc)...
call npx tsc --noEmit
if errorlevel 1 exit /b 1
echo.
echo [2/3] Chạy test...
call npm test
if errorlevel 1 exit /b 1
echo.
echo [3/3] Build thử...
call npm run build
if errorlevel 1 exit /b 1
exit /b 0

:push
if not exist .git (
  echo [!] Thư mục này chưa phải kho git. Hãy tạo kho GitHub và chạy:
  echo     git init ^&^& git remote add origin LINK_REPO
  exit /b 1
)
echo.
set "msg="
set /p msg=Nội dung cập nhật (Enter để dùng "cap nhat"):
if "!msg!"=="" set "msg=cap nhat"
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo [i] Không có thay đổi nào để đẩy lên.
  exit /b 0
)
git commit -m "!msg!"
if errorlevel 1 exit /b 1
git push
if errorlevel 1 exit /b 1
echo.
echo [OK] Đã đẩy lên GitHub. Vercel sẽ deploy sau 1-2 phút.
exit /b 0

:deployapi
echo.
echo Deploy API lên Cloudflare...
call npm run deploy:api
if errorlevel 1 exit /b 1
echo [OK] API đã cập nhật.
exit /b 0

:check
call :verify
if errorlevel 1 goto fail
echo.
echo [OK] Mọi kiểm tra đều đạt.
goto done

:web
call :verify
if errorlevel 1 goto fail
call :push
if errorlevel 1 goto fail
goto done

:api
call :install
if errorlevel 1 goto fail
call :deployapi
if errorlevel 1 goto fail
goto done

:both
call :verify
if errorlevel 1 goto fail
call :deployapi
if errorlevel 1 goto fail
call :push
if errorlevel 1 goto fail
goto done

:excel
echo.
set "xl="
set /p xl=Kéo thả file Excel vào cửa sổ này rồi nhấn Enter:
set xl=!xl:"=!
if not exist "!xl!" (
  echo [!] Không tìm thấy file.
  goto fail
)
call :install
if errorlevel 1 goto fail
echo.
echo Kiểm tra thử file (chưa ghi)...
call npm run import:places -- "!xl!" --dry
if errorlevel 1 goto fail
echo.
set /p ok=Dữ liệu hợp lệ. Ghi vào dự án? (y/n):
if /i not "%ok%"=="y" goto done
call npm run import:places -- "!xl!"
if errorlevel 1 goto fail
call :verify
if errorlevel 1 goto fail
echo.
echo Cập nhật dữ liệu lên D1...
call npm run db:push
if errorlevel 1 goto fail
call :push
if errorlevel 1 goto fail
goto done

:fail
echo.
echo ==========================================
echo  [LỖI] Có bước thất bại. Đọc thông báo ở trên.
echo  Chưa có gì được đẩy lên nếu lỗi xảy ra trước bước push.
echo ==========================================
pause
goto menu

:done
echo.
pause
goto menu

:end
endlocal
exit /b 0
