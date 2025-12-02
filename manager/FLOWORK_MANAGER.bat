@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
cls

:: ==========================================================
::  FLOWORK 서버 매니저 설정
:: ==========================================================
set SERVER_IP=212.47.68.72
set USER=root
set GIT_URL_A=https://github.com/Mingdezzi/FLOWORK_A.git
set GIT_URL_B=https://github.com/Mingdezzi/FLOWORK_B.git
set PROJECT_DIR=~/FLOWORK
set TARGET_SLOT=A
set GIT_URL=%GIT_URL_A%
set CONFIG_FILE=%~dp0manager.cfg

if exist "%CONFIG_FILE%" call :LOAD_TARGET_FROM_CONFIG

goto MAIN_MENU

:LOAD_TARGET_FROM_CONFIG
for /f "tokens=1,2 delims==" %%a in ('type "%CONFIG_FILE%"') do (
    if "%%a"=="TARGET_SLOT" (
        set TARGET_SLOT=%%b
    )
)
if "%TARGET_SLOT%"=="B" (
    set GIT_URL=%GIT_URL_B%
) else (
    set GIT_URL=%GIT_URL_A%
    set TARGET_SLOT=A
)
exit /b 0

:MAIN_MENU
cls
color 07
echo.
echo ==========================================================
echo          FLOWORK 서버 매니저 (v11.3 Fix)
echo          서버: %SERVER_IP% (%USER%)
echo          경로: %PROJECT_DIR%
echo ==========================================================
echo.
echo      [ 현재 타겟 : %TARGET_SLOT% ]
echo      연결된 깃헙 : %GIT_URL%
echo.
echo ----------------------------------------------------------
echo    [T] 🔄 타겟 전환 (A ^<-^> B)
echo.
echo    [1] 🚀 배포 메뉴 (빠른 / 클린 / 재설치)
echo.
echo    [2] 🗄️  데이터베이스 관리 (DB)
echo.
echo    [3] 📊 모니터링 (Logs)
echo.
echo    [4] 🔧 서버 관리 (Server Control)
echo.
echo    [5] 💾 백업 복원 (Restore)
echo.
echo    [99] ☢️  공장 초기화 (Factory Reset)
echo.
echo    [0] 종료
echo ==========================================================
set /p choice="선택하세요: "

if /i "%choice%"=="T" goto SWITCH_TARGET
if "%choice%"=="1" goto DEPLOY_MENU
if "%choice%"=="2" goto DB_MENU
if "%choice%"=="3" goto MONITOR_MENU
if "%choice%"=="4" goto SERVER_MENU
if "%choice%"=="5" goto RESTORE_MENU
if "%choice%"=="99" goto FACTORY_RESET
if "%choice%"=="0" exit
goto MAIN_MENU

:SWITCH_TARGET
if "%TARGET_SLOT%"=="A" (
    set TARGET_SLOT=B
    set GIT_URL=%GIT_URL_B%
) else (
    set TARGET_SLOT=A
    set GIT_URL=%GIT_URL_A%
)
echo TARGET_SLOT=%TARGET_SLOT% > "%CONFIG_FILE%"
echo.
echo [%TARGET_SLOT%] 타겟으로 전환되었습니다.
timeout /t 2 > nul
goto MAIN_MENU

:CHECK_CONNECTION
echo 📡 서버 연결 확인 중...
ssh -q -o ConnectTimeout=10 -o BatchMode=yes %USER%@%SERVER_IP% "exit" 2>nul
if errorlevel 1 (
    color 4F
    echo.
    echo ❌ 서버 연결 실패!
    echo.
    color 07
    exit /b 1
)
echo ✅ 서버 연결 성공
exit /b 0

:GET_CURRENT_DB_USER
set CURRENT_DB_USER=postgres
for /f "tokens=1,2 delims==" %%a in ('ssh -q %USER%@%SERVER_IP% "grep POSTGRES_USER %PROJECT_DIR%/.env 2>/dev/null"') do (
    if "%%a"=="POSTGRES_USER" set CURRENT_DB_USER=%%b
)
exit /b 0

:DEPLOY_MENU
cls
echo.
echo ==========================================================
echo              배포 옵션 선택 [%TARGET_SLOT%]
echo ==========================================================
echo    [1] ⚡ 빠른 배포 (Fast Deploy)
echo        - 기존 .env 유지
echo        - 코드 변경사항만 반영 (Web/Worker 재시작)
echo.
echo    [2] 🧹 클린 배포 (Clean Deploy)
echo        - 기존 .env 유지
echo        - 컨테이너/캐시 삭제 후 재빌드
echo.
echo    [3] 🆕 전체 재설치 (Re-install + Env Setup)
echo        - ID/PW 새로 입력 (.env 재생성)
echo        - [FIX] 기존 DB 데이터도 함께 초기화됨 (충돌 방지)
echo.
echo    [0] 뒤로 가기
echo ==========================================================
set /p d_choice="선택: "

if "%d_choice%"=="1" goto DEPLOY_FAST
if "%d_choice%"=="2" goto DEPLOY_CLEAN
if "%d_choice%"=="3" goto DEPLOY_RESETUP
if "%d_choice%"=="0" goto MAIN_MENU
goto DEPLOY_MENU

:DEPLOY_FAST
call :CHECK_CONNECTION
if errorlevel 1 goto DEPLOY_MENU
echo.
echo ----------------------------------------------------------
echo [빠른 배포] 타겟: %TARGET_SLOT%
echo ----------------------------------------------------------
echo.
echo [1/4] Git 동기화 (.env 보호)...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && git remote set-url origin %GIT_URL% && git fetch origin && git reset --hard origin/main && git clean -fd -e .env"

echo.
echo [2/4] 컨테이너 부분 재빌드...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose up -d --build web worker"

echo.
echo [3/4] DB 마이그레이션...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose exec -T web flask db upgrade"

echo.
echo [4/4] 상태 확인...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose ps"

echo.
echo ✅ 빠른 배포 완료.
pause
goto MAIN_MENU

:DEPLOY_CLEAN
call :CHECK_CONNECTION
if errorlevel 1 goto DEPLOY_MENU
echo.
echo ----------------------------------------------------------
echo [클린 배포] 타겟: %TARGET_SLOT%
echo ----------------------------------------------------------
echo ⚠️  기존 .env 설정은 유지되지만 컨테이너는 재시작됩니다.
set /p confirm="진행하시겠습니까? (Y/N): "
if /i not "%confirm%"=="Y" goto DEPLOY_MENU

set /p backup_choice="배포 전 DB 백업? (Y/N, 기본: Y): "
if /i "%backup_choice%"=="" set backup_choice=Y
if /i "%backup_choice%"=="Y" (
    call :GET_CURRENT_DB_USER
    for /f %%i in ('powershell -command "Get-Date -Format yyyyMMdd_HHmm"') do set TS=%%i
    set BACKUP_PATH=%USERPROFILE%\Desktop\FLOWORK_PRE_CLEAN_%TS%
    mkdir "!BACKUP_PATH!" 2>nul
    ssh -q %USER%@%SERVER_IP% "docker exec flowork_db pg_dump -U %CURRENT_DB_USER% flowork 2>/dev/null > ~/backup.sql"
    scp -q %USER%@%SERVER_IP%:~/backup.sql "!BACKUP_PATH!\backup.sql" 2>nul
    ssh -q %USER%@%SERVER_IP% "rm ~/backup.sql 2>/dev/null"
    echo ✅ 백업 완료: !BACKUP_PATH!
)

echo.
echo [1/5] 컨테이너 중지 및 캐시 정리...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose down && docker builder prune -af"

echo.
echo [2/5] Git 동기화 (.env 보호)...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && git remote set-url origin %GIT_URL% && git fetch origin && git reset --hard origin/main && git clean -fd -e .env"

echo.
echo [3/5] 전체 재빌드...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose up -d --build --force-recreate"

echo.
echo [4/5] DB 안정화 대기 (30초) 및 업그레이드...
timeout /t 30 > nul
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose exec -T web flask db upgrade"

echo.
echo [5/5] 완료 확인...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose ps"

echo.
echo ✅ 클린 배포 완료.
pause
goto MAIN_MENU

:DEPLOY_RESETUP
call :CHECK_CONNECTION
if errorlevel 1 goto DEPLOY_MENU
echo.
echo ----------------------------------------------------------
echo [전체 재설치] 타겟: %TARGET_SLOT%
echo ----------------------------------------------------------
echo ⚠️  .env 파일을 새로 생성합니다. (ID/PW 입력 필요)
echo ⚠️  기존 설정 파일 및 DB 데이터가 초기화됩니다.
echo.

set /p DB_ID="1. DB 아이디 (기본값: postgres): "
if "%DB_ID%"=="" set DB_ID=postgres

set /p DB_PW="2. DB 비밀번호 (기본값: password): "
if "%DB_PW%"=="" set DB_PW=password

set /p SECRET_KEY="3. SECRET_KEY (기본값: 자동생성): "
if "%SECRET_KEY%"=="" set SECRET_KEY=auto-generated-secret-key-%RANDOM%%RANDOM%

echo.
echo 🔒 설정 확인:
echo    - DB ID: %DB_ID%
echo    - DB PW: %DB_PW%
echo.
set /p confirm="위 정보로 재설치를 진행하시겠습니까? (Y/N): "
if /i not "%confirm%"=="Y" goto DEPLOY_MENU

set /p backup_choice="기존 DB 백업? (Y/N, 기본: Y): "
if /i "%backup_choice%"=="" set backup_choice=Y
if /i "%backup_choice%"=="Y" (
    call :GET_CURRENT_DB_USER
    for /f %%i in ('powershell -command "Get-Date -Format yyyyMMdd_HHmm"') do set TS=%%i
    set BACKUP_PATH=%USERPROFILE%\Desktop\FLOWORK_PRE_RESETUP_%TS%
    mkdir "!BACKUP_PATH!" 2>nul
    ssh -q %USER%@%SERVER_IP% "docker exec flowork_db pg_dump -U %CURRENT_DB_USER% flowork 2>/dev/null > ~/backup.sql"
    scp -q %USER%@%SERVER_IP%:~/backup.sql "!BACKUP_PATH!\backup.sql" 2>nul
    ssh -q %USER%@%SERVER_IP% "rm ~/backup.sql 2>/dev/null"
    echo ✅ 백업 완료: !BACKUP_PATH!
)

echo.
echo [1/6] 컨테이너 및 볼륨(DB데이터) 삭제...
:: [FIX] -v 옵션을 추가하여 기존 DB 볼륨을 삭제합니다.
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose down -v && docker builder prune -af"

echo.
echo [2/6] Git 동기화 (기존 .env 무시)...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && git remote set-url origin %GIT_URL% && git fetch origin && git reset --hard origin/main && git clean -fd"

echo.
echo [3/6] 새 .env 파일 생성...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && printf 'SECRET_KEY=%SECRET_KEY%\nDATABASE_URL=postgresql://%DB_ID%:%DB_PW%@db:5432/flowork\nPOSTGRES_USER=%DB_ID%\nPOSTGRES_PASSWORD=%DB_PW%\nPOSTGRES_DB=flowork\nTZ=Asia/Seoul\nCELERY_BROKER_URL=redis://redis:6379/0\nCELERY_RESULT_BACKEND=redis://redis:6379/0\n' > .env"

echo.
echo [4/6] 전체 재빌드 및 실행...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose up -d --build --force-recreate"

echo.
echo [5/6] DB 안정화 대기 (30초) 및 업그레이드...
timeout /t 30 > nul
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose exec -T web flask db upgrade"

echo.
echo [6/6] 완료 확인...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose ps"

echo.
echo ✅ 재설치 배포 완료.
pause
goto MAIN_MENU

:DB_MENU
cls
echo.
echo ==========================================================
echo              데이터베이스 관리
echo ==========================================================
echo    [1] 통합 백업 (DB + 이미지)
echo    [2] DB 마이그레이션 (Migrate)
echo    [3] DB 업그레이드 (Upgrade)
echo    [4] DB 초기화 (Init - 주의)
echo    [5] DB 상태 확인
echo    [6] DB 직접 접속 (psql)
echo    [0] 뒤로 가기
echo ==========================================================
set /p db_choice="선택: "

if "%db_choice%"=="1" goto DB_BACKUP
if "%db_choice%"=="2" goto DB_MIGRATE
if "%db_choice%"=="3" goto DB_UPGRADE
if "%db_choice%"=="4" goto DB_INIT_MIGRATE
if "%db_choice%"=="5" goto DB_STATUS
if "%db_choice%"=="6" goto DB_CONNECT
if "%db_choice%"=="0" goto MAIN_MENU
goto DB_MENU

:DB_BACKUP
call :CHECK_CONNECTION
if errorlevel 1 goto DB_MENU
call :GET_CURRENT_DB_USER
echo.
echo [백업 시작] 사용자: %CURRENT_DB_USER%
for /f %%i in ('powershell -command "Get-Date -Format yyyyMMdd_HHmm"') do set TS=%%i
set BACKUP_PATH=%USERPROFILE%\Desktop\FLOWORK_BACKUP_%TS%
mkdir "!BACKUP_PATH!" 2>nul

echo [1/4] DB 크기 확인...
ssh %USER%@%SERVER_IP% "docker exec flowork_db psql -U %CURRENT_DB_USER% -d flowork -c '\l+' 2>/dev/null | grep flowork"

echo.
echo [2/4] DB 덤프 중...
ssh %USER%@%SERVER_IP% "docker exec flowork_db pg_dump -U %CURRENT_DB_USER% flowork > ~/backup.sql"

echo.
echo [3/4] 이미지 압축 중...
ssh %USER%@%SERVER_IP% "tar -czf ~/images.tar.gz -C %PROJECT_DIR%/flowork/static product_images 2>/dev/null || echo '이미지 없음'"

echo.
echo [4/4] 로컬로 다운로드 중...
scp -q %USER%@%SERVER_IP%:~/backup.sql "%BACKUP_PATH%\backup.sql"
scp -q %USER%@%SERVER_IP%:~/images.tar.gz "%BACKUP_PATH%\images.tar.gz" 2>nul
ssh -q %USER%@%SERVER_IP% "rm ~/backup.sql ~/images.tar.gz 2>/dev/null"

echo.
echo ✅ 백업 완료: %BACKUP_PATH%
pause
goto DB_MENU

:DB_MIGRATE
call :CHECK_CONNECTION
if errorlevel 1 goto DB_MENU
echo.
set /p msg="마이그레이션 메시지 (기본값: Auto migration): "
if "%msg%"=="" set msg=Auto migration
echo.
echo 마이그레이션 파일 생성 중...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose exec -T web flask db migrate -m '%msg%'"
if errorlevel 1 (
    echo ❌ 실패했습니다. 로그를 확인하세요.
) else (
    echo ✅ 완료되었습니다. [3] DB 업그레이드를 실행하여 적용하세요.
)
pause
goto DB_MENU

:DB_UPGRADE
call :CHECK_CONNECTION
if errorlevel 1 goto DB_MENU
echo.
echo DB 업그레이드(적용) 실행 중...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose exec -T web flask db upgrade"
if errorlevel 1 (
    echo ❌ 실패했습니다.
) else (
    echo ✅ 성공했습니다.
)
pause
goto DB_MENU

:DB_INIT_MIGRATE
call :CHECK_CONNECTION
if errorlevel 1 goto DB_MENU
echo.
echo ⚠️  경고: 마이그레이션 폴더를 초기화합니다.
set /p confirm="계속하시겠습니까? (Y/N): "
if /i not "%confirm%"=="Y" goto DB_MENU
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose exec -T web flask db init"
pause
goto DB_MENU

:DB_STATUS
call :CHECK_CONNECTION
if errorlevel 1 goto DB_MENU
call :GET_CURRENT_DB_USER
echo.
echo [테이블 목록]
ssh %USER%@%SERVER_IP% "docker exec flowork_db psql -U %CURRENT_DB_USER% -d flowork -c '\dt' 2>/dev/null"
echo.
echo [마이그레이션 히스토리]
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose exec -T web flask db history 2>/dev/null | head -10"
pause
goto DB_MENU

:DB_CONNECT
call :CHECK_CONNECTION
if errorlevel 1 goto DB_MENU
call :GET_CURRENT_DB_USER
echo.
echo DB 접속 중... (사용자: %CURRENT_DB_USER%)
echo 종료하려면 \q 를 입력하세요.
echo.
ssh -t %USER%@%SERVER_IP% "docker exec -it flowork_db psql -U %CURRENT_DB_USER% -d flowork"
pause
goto DB_MENU

:RESTORE_MENU
cls
echo.
echo ==========================================================
echo              백업 복원
echo ==========================================================
echo    [1] DB 복원 (backup.sql)
echo    [2] 이미지 복원 (images.tar.gz)
echo    [0] 뒤로 가기
echo ==========================================================
set /p restore_choice="선택: "

if "%restore_choice%"=="1" goto RESTORE_DB
if "%restore_choice%"=="2" goto RESTORE_IMAGES
if "%restore_choice%"=="0" goto MAIN_MENU
goto RESTORE_MENU

:RESTORE_DB
call :CHECK_CONNECTION
if errorlevel 1 goto RESTORE_MENU
call :GET_CURRENT_DB_USER
echo.
echo [DB 복원]
set /p backup_file="backup.sql 파일 전체 경로 입력: "
if not exist "%backup_file%" (
    echo ❌ 파일을 찾을 수 없습니다.
    pause
    goto RESTORE_MENU
)
echo.
echo ⚠️  현재 DB 데이터가 모두 삭제되고 덮어씌워집니다!
set /p confirm="계속하시겠습니까? (Y/N): "
if /i not "%confirm%"=="Y" goto RESTORE_MENU

echo [1/3] 파일 업로드 중...
scp -q "%backup_file%" %USER%@%SERVER_IP%:~/restore.sql

echo [2/3] DB 초기화(재생성) 중...
ssh %USER%@%SERVER_IP% "docker exec flowork_db psql -U %CURRENT_DB_USER% -c 'DROP DATABASE IF EXISTS flowork;' && docker exec flowork_db psql -U %CURRENT_DB_USER% -c 'CREATE DATABASE flowork;'"

echo [3/3] 데이터 복원 중...
ssh %USER%@%SERVER_IP% "docker exec -i flowork_db psql -U %CURRENT_DB_USER% flowork < ~/restore.sql && rm ~/restore.sql"

echo ✅ 복원 완료.
pause
goto RESTORE_MENU

:RESTORE_IMAGES
call :CHECK_CONNECTION
if errorlevel 1 goto RESTORE_MENU
echo.
echo [이미지 복원]
set /p img_file="images.tar.gz 파일 전체 경로 입력: "
if not exist "%img_file%" (
    echo ❌ 파일을 찾을 수 없습니다.
    pause
    goto RESTORE_MENU
)

echo [1/2] 파일 업로드 중...
scp -q "%img_file%" %USER%@%SERVER_IP%:~/images.tar.gz

echo [2/2] 압축 해제 중...
ssh %USER%@%SERVER_IP% "tar -xzf ~/images.tar.gz -C %PROJECT_DIR%/flowork/static && rm ~/images.tar.gz"

echo ✅ 복원 완료.
pause
goto RESTORE_MENU

:MONITOR_MENU
call :CHECK_CONNECTION
if errorlevel 1 goto MAIN_MENU
cls
echo.
echo ==========================================================
echo              모니터링 (로그 확인)
echo ==========================================================
echo    [1] WEB 로그
echo    [2] WORKER 로그
echo    [3] DB 로그
echo    [4] REDIS 로그
echo    [5] 전체 로그
echo    [6] 에러(Error) 로그만 보기
echo    [0] 뒤로 가기
echo ==========================================================
set /p m_choice="선택: "

if "%m_choice%"=="1" ssh -t %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose logs -f --tail=100 web"
if "%m_choice%"=="2" ssh -t %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose logs -f --tail=100 worker"
if "%m_choice%"=="3" ssh -t %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose logs -f --tail=100 db"
if "%m_choice%"=="4" ssh -t %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose logs -f --tail=100 redis"
if "%m_choice%"=="5" ssh -t %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose logs -f --tail=100"
if "%m_choice%"=="6" ssh -t %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose logs --tail=200 | grep -i error"
if "%m_choice%"=="0" goto MAIN_MENU
goto MONITOR_MENU

:SERVER_MENU
call :CHECK_CONNECTION
if errorlevel 1 goto MAIN_MENU
cls
echo.
echo ==========================================================
echo              서버 관리
echo ==========================================================
echo    [1] 컨테이너 상태 확인 (Status)
echo    [2] 컨테이너 재시작 (Restart)
echo    [3] 컨테이너 중지 (Stop)
echo    [4] 디스크 사용량 (Disk)
echo    [5] 도커 이미지 정리 (Prune)
echo    [6] 서버 재부팅 (Reboot)
echo    [0] 뒤로 가기
echo ==========================================================
set /p s_choice="선택: "

if "%s_choice%"=="1" goto SERVER_STATUS
if "%s_choice%"=="2" goto SERVER_RESTART
if "%s_choice%"=="3" goto SERVER_STOP
if "%s_choice%"=="4" goto SERVER_DISK
if "%s_choice%"=="5" goto SERVER_CLEAN
if "%s_choice%"=="6" goto SERVER_REBOOT
if "%s_choice%"=="0" goto MAIN_MENU
goto SERVER_MENU

:SERVER_STATUS
call :CHECK_CONNECTION
echo.
echo [컨테이너 상태]
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose ps"
echo.
echo [리소스 사용량]
ssh %USER%@%SERVER_IP% "docker stats --no-stream"
pause
goto SERVER_MENU

:SERVER_RESTART
call :CHECK_CONNECTION
echo.
echo [컨테이너 재시작]
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose restart"
echo ✅ 완료.
pause
goto SERVER_MENU

:SERVER_STOP
call :CHECK_CONNECTION
echo.
echo ⚠️  모든 컨테이너를 중지합니다.
set /p confirm="계속하시겠습니까? (Y/N): "
if /i not "%confirm%"=="Y" goto SERVER_MENU
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose down"
echo ✅ 완료.
pause
goto SERVER_MENU

:SERVER_DISK
call :CHECK_CONNECTION
echo.
echo [디스크 사용량]
ssh %USER%@%SERVER_IP% "df -h"
echo.
echo [도커 시스템]
ssh %USER%@%SERVER_IP% "docker system df"
pause
goto SERVER_MENU

:SERVER_CLEAN
call :CHECK_CONNECTION
echo.
echo [도커 정리]
echo 사용하지 않는 이미지와 캐시를 삭제합니다.
set /p confirm="계속하시겠습니까? (Y/N): "
if /i not "%confirm%"=="Y" goto SERVER_MENU
ssh %USER%@%SERVER_IP% "docker system prune -af"
echo ✅ 완료.
pause
goto SERVER_MENU

:SERVER_REBOOT
call :CHECK_CONNECTION
echo.
color 4F
echo ⚠️  경고: 서버를 재부팅합니다!
color 07
set /p confirm="확인하려면 'reboot' 을 입력하세요: "
if not "%confirm%"=="reboot" goto MAIN_MENU
ssh %USER%@%SERVER_IP% "reboot"
echo 🔄 재부팅 명령이 전송되었습니다.
pause
goto MAIN_MENU

:DB_INIT_PROCEDURE
echo.
echo --------------------------------------------------------------------------------
echo [DB 초기화 프로세스]
echo --------------------------------------------------------------------------------

echo.
echo [1/2] Flask init-db 실행
timeout /t 5 > nul
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose run --rm web flask init-db"

echo.
echo 대기 중 (5초)...
timeout /t 5 > nul

echo.
echo [2/2] Flask db upgrade 실행
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose run --rm web flask db upgrade"

echo.
echo ✅ DB 초기화 완료.
exit /b 0

:FACTORY_RESET
cls
color 4F
echo ==========================================================
echo          공장 초기화 (설치 버전: %TARGET_SLOT%)
echo ==========================================================
echo    경고: 모든 데이터를 삭제하고 %TARGET_SLOT% 버전을 새로 설치합니다.
echo.
set /p confirm="진행하려면 'RESET' 을 입력하세요: "
color 07
if not "%confirm%"=="RESET" goto MAIN_MENU

call :CHECK_CONNECTION

echo.
echo ----------------------------------------------------------
echo    설정 마법사 (.env 생성)
echo ----------------------------------------------------------
set /p DB_ID="1. DB 아이디 (기본값: postgres): "
if "%DB_ID%"=="" set DB_ID=postgres

set /p DB_PW="2. DB 비밀번호 (기본값: password): "
if "%DB_PW%"=="" set DB_PW=password

set /p SECRET_KEY="3. SECRET_KEY (기본값: 자동생성): "
if "%SECRET_KEY%"=="" set SECRET_KEY=auto-generated-secret-key-%RANDOM%%RANDOM%

echo.
echo 설정 확인:
echo    - DB ID: %DB_ID%
echo    - DB PW: %DB_PW%
echo    - SECRET: %SECRET_KEY%
echo.
set /p final_confirm="이 설정으로 진행하시겠습니까? (Y/N): "
if /i not "%final_confirm%"=="Y" goto MAIN_MENU

echo.
echo [1/8] 기존 컨테이너 삭제 중...
ssh %USER%@%SERVER_IP% "if [ -d %PROJECT_DIR% ]; then cd %PROJECT_DIR% && docker compose down -v 2>/dev/null; fi"

echo.
echo [2/8] 폴더 완전 삭제 중...
ssh %USER%@%SERVER_IP% "rm -rf %PROJECT_DIR%"

echo.
echo [3/8] Git Clone (%TARGET_SLOT%)...
ssh %USER%@%SERVER_IP% "git clone %GIT_URL% %PROJECT_DIR%"

echo.
echo [4/8] .env 파일 생성 중...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && printf 'SECRET_KEY=%SECRET_KEY%\nDATABASE_URL=postgresql://%DB_ID%:%DB_PW%@db:5432/flowork\nPOSTGRES_USER=%DB_ID%\nPOSTGRES_PASSWORD=%DB_PW%\nPOSTGRES_DB=flowork\nTZ=Asia/Seoul\nCELERY_BROKER_URL=redis://redis:6379/0\nCELERY_RESULT_BACKEND=redis://redis:6379/0\n' > .env"

echo.
echo [5/8] Docker 빌드 및 실행...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose up -d --build"

echo.
echo [6/8] 서비스 기동 대기 (60초)...
timeout /t 60 > nul

echo.
echo [7/8] 컨테이너 상태 확인...
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose ps"

echo.
echo [8/8] DB 초기화 작업...
echo    DB 안정화 대기 (30초)...
timeout /t 30 > nul
call :DB_INIT_PROCEDURE

echo.
echo [최종 점검]
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose ps"

echo.
echo [로그 확인 (최근 30줄)]
ssh %USER%@%SERVER_IP% "cd %PROJECT_DIR% && docker compose logs --tail=30 web"

echo.
echo ✨ 공장 초기화 완료: %TARGET_SLOT%
echo URL: http://%SERVER_IP%
echo DB: %DB_ID% / flowork
pause
goto MAIN_MENU